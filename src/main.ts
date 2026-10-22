import { createPinia } from 'pinia';
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import Vant from 'vant';

import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'vant/lib/index.css';
import '@/styles/main.scss';

import App from './App.vue';
import router from './router';
import { useSettingsStore } from '@/stores/settingsStore';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.use(Vant);

useSettingsStore().init();

app.mount('#app');
