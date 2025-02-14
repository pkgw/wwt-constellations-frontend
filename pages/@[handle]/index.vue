<template>
  <div id="handle-page-root">
    <MainOverlay :described-handle="handle_data || undefined" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { nextTick } from "vue";
import { RouteLocationNormalized } from "vue-router";

import { getHandle, handlePermissions } from "~/utils/apis";
import { useConstellationsStore } from "~/stores/constellations";

definePageMeta({
  // Does this page actually exist? I'm not sure if I'm doing this right, but it
  // seems to work.
  validate: async (route: RouteLocationNormalized) => {
    // As far as I can tell, this function can't use bindings from the outer
    // module, so we have to re-import $backendCall.
    const { $backendCall } = useNuxtApp();
    const handle = route.params.handle as string;

    const { data } = await useAsyncData(`handle-${handle}`, async () => {
      return getHandle($backendCall, handle);
    });

    return !!data.value;
  }
});

// Now the main page implementation, which has to repeat some of the work done
// in the validate callback.

const { $backendCall, $backendAuthCall } = useNuxtApp();

const constellationsStore = useConstellationsStore();
const { loggedIn } = storeToRefs(constellationsStore);

const route = useRoute();
const handle = route.params.handle as string;

const { data: handle_data } = await useAsyncData(`handle-${handle}`, async () => {
  return getHandle($backendCall, handle);
});

const can_dashboard = ref(false);

useHead({
  title: `@${handle} - WorldWide Telescope`,
  meta: [{
    name: 'WorldWide Telescope',
    content: `Explore images by @${handle}, visualized by the WorldWide Telescope engine`
  }]
})

watchEffect(async () => {
  if (!loggedIn.value) {
    can_dashboard.value = false;
  } else {
    const fetcher = await $backendAuthCall();
    const result = await handlePermissions(fetcher, handle);
    can_dashboard.value = result && result.view_dashboard || false;
  }
});

onMounted(() => {
  constellationsStore.useHandleTimeline(handle);
  nextTick(() => {
    constellationsStore.ensureForwardCoverage(8);
  });
});
</script>

<style scoped lang="less">
#handle-page-root {
  color: #FFF;
  height: 100%;
}
</style>
