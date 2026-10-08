import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:process.cwd(),plugins:[react()],define:{'process.env.NEXT_PUBLIC_GOALIO_DEMO_DATE':'"true"'},resolve:{alias:{'@':process.cwd()}},server:{host:'127.0.0.1',port:4174,strictPort:true},appType:'mpa'});
