import { createRouter, createWebHashHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

import { APP_TITLE } from '@/constants';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
    meta: { title: '验证码' }
  },
  {
    path: '/sync',
    name: 'sync',
    component: () => import('@/views/Sync.vue'),
    meta: { title: '同步' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '';
  document.title = title ? `${title} · ${APP_TITLE}` : APP_TITLE;
});

export default router;
