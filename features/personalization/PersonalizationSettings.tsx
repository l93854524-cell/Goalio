"use client";

import { HELLO_KITTY_BACKGROUNDS, HOME_BLOCKS, THEMES, type Personalization } from "./usePersonalization";

export function PersonalizationSettings({ settings }: { settings: Personalization }) {
  return (
    <section className="personalization-settings" aria-labelledby="personalization-title">
      <div className="personalization-heading">
        <h2 id="personalization-title">个性化</h2>
        <button className="appearance-reset" onClick={settings.reset}>恢复默认</button>
      </div>
      <div className="personalization-card">
        <fieldset className="theme-picker">
          <legend>主题色{settings.theme === "default" && <small> · 默认外观</small>}</legend>
          <div className="theme-options">
            {THEMES.map(theme => (
              <button key={theme.id} aria-pressed={settings.theme === theme.id} onClick={() => settings.selectTheme(theme.id)}>
                <span className="theme-swatch" style={{ backgroundColor: theme.color }} aria-hidden="true">
                  {settings.theme === theme.id && "✓"}
                </span>
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="card-image-settings">
          <strong>首页板块图片</strong>
          <p id="card-image-help">5 个板块可分别选图。图片仅保存在当前浏览器，金额上方会自动添加遮罩。</p>
          <button className="kitty-example" onClick={settings.useHelloKitty}>使用 Hello Kitty 示例</button>
          <div className="card-image-options">
            {HOME_BLOCKS.map((block, index) => {
              const source = settings.blocks[block.id];
              return <div className="card-image-option" key={block.id}>
                <div className="card-image-thumbnail" aria-hidden="true" style={source ? { backgroundImage: `url("${source}")` } : undefined}>
                  {!source && <span>{index + 1}</span>}
                </div>
                <div className="card-image-controls">
                  <strong>{block.label}</strong>
                  <small>{source === HELLO_KITTY_BACKGROUNDS[block.id] ? "Hello Kitty 示例" : source ? "已设置本地图片" : block.hint}</small>
                  <div>
                    <label className="background-file-picker">
                      <span>{settings.processingTarget === block.id ? "处理图片中…" : source ? "更换图片" : "选择图片"}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label={`选择${block.label}图片`} aria-describedby="card-image-help" disabled={settings.processing} onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void settings.selectBlockBackground(block.id, file);
                      }} />
                    </label>
                    {source && <button className="background-remove" aria-label={`移除${block.label}图片`} onClick={() => settings.removeBlockBackground(block.id)}>移除</button>}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </div>
        <div className="background-setting">
          <strong>首页背景</strong>
          <p id="background-help">图片仅保存在当前浏览器，不上传，也不随账号同步。</p>
          <label className="background-file-picker">
            <span>{settings.processingTarget === "background" ? "正在处理图片…" : settings.background ? "更换图片" : "选择图片"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="选择首页背景图片" aria-describedby="background-help" disabled={settings.processing} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void settings.selectBackground(file);
            }} />
          </label>
          {settings.background && <button className="background-remove" onClick={settings.removeBackground}>移除背景</button>}
          {settings.processing && <p role="status">正在本地处理图片，请稍候。</p>}
          {settings.background && !settings.processing && <p className="background-saved">已设置背景 · 首页自动添加遮罩</p>}
        </div>
        {settings.error && <p className="appearance-error" role="alert">{settings.error}</p>}
      </div>
    </section>
  );
}
