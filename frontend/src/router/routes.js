const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', redirect: '/manage' },
      { path: '/manage', component: () => import('pages/ManagePage.vue') },
      { path: '/unmanaged', component: () => import('pages/UnmanagedPage.vue') },
      { path: '/download', component: () => import('pages/DownloadPage.vue') },
      { path: '/settings', component: () => import('pages/SettingsPage.vue') },
      { path: '/guide', component: () => import('pages/GuidePage.vue') },
    ],
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
