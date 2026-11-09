import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-svelte'],
  alias: { '@src': 'src' },
  manifest: {
    name: 'Reframe — YouTube, intentionally',
    short_name: 'Reframe',
    description:
      'A calmer, subscription-first YouTube experience with private local progress, collections, and focus controls.',
    version: '0.1.0',
    minimum_chrome_version: '116',
    permissions: ['storage'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'Reframe settings',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
      },
    },
    content_scripts: [
      {
        matches: ['https://www.youtube.com/*'],
        css: ['youtube-page.css'],
        run_at: 'document_start',
      },
    ],
  },
});
