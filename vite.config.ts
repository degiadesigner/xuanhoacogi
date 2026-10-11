import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:5173,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true},base:process.env.PUBLIC_BASE_PATH || '/',css:{postcss:{plugins:[tailwindcss()]}},resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify((process.env.PUBLIC_BASE_PATH || '/').replace(/\/$/,''))}});
