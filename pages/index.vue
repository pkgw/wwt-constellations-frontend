<template>
  <MainOverlay />
</template>

<script setup lang="ts">
import { nextTick } from "vue";

import { useConstellationsStore } from "~/stores/constellations";

const constellationsStore = useConstellationsStore();

useHead({
  title: "WorldWide Telescope",
  meta: [{
    name: "WorldWide Telescope",
    content: "Explore and share beautiful, real images from the world’s best telescopes."
  }]
})

// https://github.com/harlan-zw/zhead/blob/main/src/metaFlat.ts
// https://api.slack.com/reference/messaging/link-unfurling#classic_unfurl
// https://ogp.me/#implementations -> links to testing tools from various services

const nuxtConfig = useRuntimeConfig();
const route = useRoute();

useServerSeoMeta({
  applicationName: "WorldWide Telescope",
  ogTitle: "WorldWide Telescope",
  ogDescription: "Explore and share beautiful, real images from the world’s best telescopes.",
  ogSiteName: "WorldWide Telescope",
  ogUrl: `${nuxtConfig.public.hostUrl}${route.fullPath}`,
  ogImage: require("~/assets/images/wwt_banner.jpg"),
  ogImageSecureUrl: require("~/assets/images/wwt_banner.jpg"),
  ogImageWidth: 1280,
  ogImageHeight: 350,
  ogImageType: "image/jpeg",
  ogImageAlt: "WorldWide Telescope banner",
  ogType: "website",
  twitterSite: "@wwtelescope",
  twitterCard: "summary_large_image",
  twitterImage: require("~/assets/images/wwt_banner.jpg"),
});

onMounted(() => {
  constellationsStore.useGlobalTimeline();

  nextTick(async () => {
    await constellationsStore.ensureForwardCoverage(8);
  });
});
</script>
