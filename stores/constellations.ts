import { $Fetch } from "ofetch";
import { defineStore } from "pinia";
import { useBreakpoints } from "@vueuse/core";

import { getHomeTimeline, getHandleTimeline, GetSceneResponseT, TimelineResponseT } from "~/utils/apis";
import { SceneDisplayInfoT } from "~/utils/types";

export const useConstellationsStore = defineStore("wwt-constellations", () => {
  // Whether the user is logged in.
  const loggedIn = ref(false);

  // Whether we seem to be in a mobile layout

  const breakpoints = useBreakpoints({
    tablet: 640,
    laptop: 1024,
    desktop: 1280,
  });

  const isMobile = breakpoints.smaller("laptop");

  // Whether the WWT viewer should be shown. This will be false for some
  // administrative screens. This is a state parameter because we don't want to
  // repeatedly create and destroy the WWT widget, so we include it in the very
  // root of the app layout.
  const showWWT = ref(true);

  // This is true when the WWT view is initially created. In that case, when the
  // first scene to display is selected, we warp straight to its location,
  // rather than slewing.
  const viewNeedsInitialization = ref(true);

  // Scenes whose information we've loaded, keyed by their IDs.
  const knownScenes = ref<Map<string, GetSceneResponseT>>(new Map());

  // The scene whose information should be displayed in the main overlay.
  const describedScene = ref<GetSceneResponseT | null>(null);

  // The desired scene for the WWT viewer to display, and the detailed
  // information that the engine needs to show it. The scene may not actually be
  // centered in the view if the user has panned elsewhere, if we're currently
  // slewing towards it, etc.
  const desiredScene = ref<SceneDisplayInfoT | null>(null);

  // The history of visited scenes
  const sceneHistory = ref<GetSceneResponseT[]>([]);
  const historyIndex = ref(-1);
  const futureScenes = ref<GetSceneResponseT[]>([]);

  type ScenesGetter = (fetcher: $Fetch, pageNum: number) => Promise<TimelineResponseT>;

  let getNextScenes: ScenesGetter | null = getHomeTimeline;
  let nextNeededPage = 0;
  type NextSceneSourceType = { type: 'global' } |
                             { type: 'handle'; handle: string } |
                             { type: 'nearby', baseID: string };
  let nextSceneSource: NextSceneSourceType = { type: 'global' };

  // The ordered list of scene IDs that constitutes our current "timeline". This
  // list is completed from the start of the timeline to as far as it goes; we
  // may be able to extend it by fetching more scenes. If we are not currently
  // navigating a timeline, the list is empty. All of these scene IDs must have
  // corresponding records in the `knownScenes` map.
  const timeline = ref<string[]>([]);

  // The index of the currently viewed scene within the `timeline` array.
  // Someone should make sure that this selection, `describedScene`, and
  // `desiredScene` stay in some reasonable level of synchronization, but they
  // can in principle vary. This should be -1 if nothing is selected or we're
  // not in a timeline mode (i.e., `timeline` is empty).
  const timelineIndex = ref(0);

  // The source of further items for the timeline, if we need them. There are
  // three broad possibilities. If this is null, we're not in a timeline mode,
  // and there's nothing to fetch. If this is the empty string, we're exploring
  // the "home" timeline. Otherwise, the value of this field is the name of a
  // handle, and we're exploring that handle's timeline.
  const timelineSource = ref<string | null>("");

  var getTimeline: typeof getHomeTimeline | null = getHomeTimeline;
  var timelineSequence = 0;
  var nextNeededTimelinePage = 0;

  // Set up state for a single scene. NOTE: before calling this function, you
  // must have already set timelineSource to null and let a render clock tick
  // elapse! This is because the watcher for changes to `timelineSource` below
  // will reset knownScenes. This is all quite gnarly and gross and should be
  // rationalized.
  function setupForSingleScene(scene: GetSceneResponseT) {
    timelineIndex.value = -1;
    describedScene.value = scene;
    desiredScene.value = {
      id: scene.id,
      place: scene.place,
      content: scene.content,
    };
    knownScenes.value.set(scene.id, scene);
  }

  // Ensure that the timeline data structure extends at least `n` items past the
  // current index. If the timeline was initially empty, this will set the
  // current index to the first position. If something fails badly in the
  // backend, it is possible that this function will give up without actually
  // achieving its goal.
  async function ensureTimelineCoverage(n: number) {
    // If we're not in a timeline mode, the most appropriate thing to do is
    // nothing.
    if (getTimeline === null) {
      return;
    }

    const init_index = (timelineIndex.value < 0);
    const target_length = init_index ? n : timelineIndex.value + n;
    const our_sequence = timelineSequence;
    const MAX_ATTEMPTS = 5;

    // Note that we are currently using $backendCall, not $backendAuthCall,
    // because none of the feeds are personalized. To get personalized feeds
    // we'll need to change that. (And we might also need to fix things up so
    // that we can make authenticated calls in the server-side rendering phase.)
    const { $backendCall } = useNuxtApp();

    for (var attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // If, during one of our asynchronous attempts, the app has
      // moved on to caring about a different timeline altogether,
      // go home.
      if (timelineSequence != our_sequence) {
        return;
      }

      // If we're in the same sequence but we've gotten enough items, we're
      // done.
      if (timeline.value.length >= target_length) {
        break;
      }

      // Try to get the next page that we think is needed.
      const our_page = nextNeededTimelinePage;
      const result = await getTimeline($backendCall, our_page);

      // Due to the "await", some unknowable amount of time has passed since we
      // put in the API request, and someone else may already have filled in the
      // timeline or switched us to a new timeline. Only edit the global
      // structure if it appears that our results are still wanted and needed.

      if (timelineSequence == our_sequence && nextNeededTimelinePage == our_page) {
        for (var scene of result.results) {
          knownScenes.value.set(scene.id, scene);
          timeline.value.push(scene.id);
        }

        nextNeededTimelinePage += 1;
      }
    }

    if (init_index) {
      timelineIndex.value = 0;
    }
  }

  async function setTimelineIndex(n: number) {
    timelineIndex.value = n;
    await ensureTimelineCoverage(n + 5);
  }

  async function ensureForwardCoverage(n: number) {
    console.log("ensureForwardCoverage", n);
    console.log(getNextScenes);
    if (getNextScenes === null) {
      return;
    }

    const MAX_ATTEMPTS = 5;
    const targetLength = n;
    const { $backendCall } = useNuxtApp();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (futureScenes.value.length >= targetLength) {
        console.log(`ensureForwardCoverage: exiting early`);
        break;
      }

      const page = nextNeededPage;
      const result = await getNextScenes($backendCall, page);
      console.log(result);

      if (nextNeededPage === page) {
        for (const scene of result.results) {
          knownScenes.value.set(scene.id, scene);
          futureScenes.value.push(scene);
        }
      }

      nextNeededPage += 1;
    }
  }

  function moveBack(count=1) {
    // We're at the beginning of the history - there's nowhere back to go
    if (sceneHistory.value.length === 0 || historyIndex.value === 0) {
      return;
    }
    historyIndex.value = Math.max(0, historyIndex.value - count);;
    desiredScene.value = sceneHistory.value[historyIndex.value];
  }

  async function moveForward(count=1) {
    if (count <= 0) {
      return;
    }
    console.log(sceneHistory.value);
    let scene: GetSceneResponseT | undefined = undefined;
    
    // The first argument to `Math.min` is to account for the setup case where sceneHistory is empty
    const canMoveForwardInHistory = Math.min(sceneHistory.value.length, count, sceneHistory.value.length - 1 - historyIndex.value);

    // The setup here is so that we only modify scene history and index once, at the end
    let remaining = count - canMoveForwardInHistory;
    let index = historyIndex.value + canMoveForwardInHistory;
    const scenesToAdd: GetSceneResponseT[] = [];

    while (remaining > 0) {
      if (futureScenes.value.length === 0) {
        await ensureForwardCoverage(remaining); // Should this be larger?
      }
      scene = futureScenes.value.shift();
      if (scene) {
        scenesToAdd.push(scene);
        index += 1;
      }
      remaining -= 1;
    }

    index = Math.max(0, index);
    sceneHistory.value = sceneHistory.value.concat(scenesToAdd);
    historyIndex.value = index;
  }

  async function moveToScene(id: string) {
    updateNextSceneSource({ type: 'nearby', baseID: id });
    let scene = knownScenes.value.get(id);
    if (scene === undefined) {
      const { $backendCall } = useNuxtApp();
      const fetchedScene = await getScene($backendCall, id);
      if (fetchedScene === null) {
        return;
      }
      scene = fetchedScene;
    }
    await ensureForwardCoverage(8);

    sceneHistory.value.push(scene);
    historyIndex.value += 1;
  }

  function needToChangeSceneSource(source: NextSceneSourceType) {
    return !((source.type === 'global' && nextSceneSource.type === 'global') ||
             (source.type === 'handle' && nextSceneSource.type === 'handle' && source.handle === nextSceneSource.handle) ||
             (source.type === 'nearby' && nextSceneSource.type === 'nearby' && source.baseID === nextSceneSource.baseID));
  }

  function updateNextSceneSource(source: NextSceneSourceType) {
    if (!needToChangeSceneSource(source)) {
      return;
    }
    if (source.type === 'global') {
      getNextScenes = getHomeTimeline;
    } else if (source.type === 'handle') {
      getNextScenes = (fetcher, page) => getHandleTimeline(fetcher, source.handle, page);
    } else if (source.type === 'nearby') {
      // TODO: How to handle pagination for the nearby timeline?
      getNextScenes = async (fetcher, page) => {
        if (page === 0) {
          return getNearbyTimeline(fetcher, source.baseID);
        } else {
          return { results: [] };
        }
      }
    }
    
    sceneHistory.value = sceneHistory.value.splice(historyIndex.value);
    futureScenes.value = [];
    nextNeededPage = 0;
  }

  function useGlobalTimeline() {
    updateNextSceneSource({ type: 'global' });
  }

  function useHandleTimeline(handle: string) {
    updateNextSceneSource({ type: 'handle', handle });
  }


  watch(timelineSource, async (newSource, oldSource) => {
    if (newSource == null) {
      getTimeline = null;
      nextNeededTimelinePage = 0;
      timelineSequence += 1;
      timeline.value = [];
      timelineIndex.value = -1;
      knownScenes.value = new Map();

      if (describedScene.value !== null) {
        knownScenes.value.set(describedScene.value.id, describedScene.value);
      }
    } else if (newSource != oldSource) {
      if (newSource == "") {
        getTimeline = getHomeTimeline;
      } else {
        getTimeline = (fetcher: $Fetch, page: number) => getHandleTimeline(fetcher, newSource, page);
      }

      nextNeededTimelinePage = 0;
      timelineSequence += 1;
      timeline.value = [];
      timelineIndex.value = -1;
    }
  });

  // Cross-component plumbing for the region-of-interest display

  const roiEditHeightPercentage = ref(50);
  const roiEditWidthPercentage = ref(50);

  // Cross-component plumbing for positioning the WWT camera

  const viewportLeftBlockage = ref(0);
  const viewportBottomBlockage = ref(0);

  const isMovingToScene = ref(false);

  return {
    describedScene,
    desiredScene,
    ensureTimelineCoverage,
    isMobile,
    isMovingToScene,
    knownScenes,
    loggedIn,
    roiEditHeightPercentage,
    roiEditWidthPercentage,
    setTimelineIndex,
    setupForSingleScene,
    showWWT,
    timeline,
    timelineIndex,
    timelineSource,
    viewNeedsInitialization,
    viewportBottomBlockage,
    viewportLeftBlockage,

    sceneHistory,
    historyIndex,
    futureScenes,
    moveBack,
    moveForward,
    moveToScene,
    ensureForwardCoverage,
    useGlobalTimeline,
    useHandleTimeline
  }
});
