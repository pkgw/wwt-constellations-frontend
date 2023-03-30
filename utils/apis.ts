// Copyright 2023 the .NET Foundation

// Interfaces associated with backend APIs

import { isLeft } from "fp-ts/lib/Either.js";
import * as t from "io-ts";
import { PathReporter } from "io-ts/lib/PathReporter.js";
import { $Fetch } from "ofetch";

import { PlaceDetails } from "./types";

function checkForError(item: any) {
  if (typeof item.error === "boolean" && item.error) {
    if (typeof item.message === "string") {
      throw new Error(`API server returned error: ${item.message}`);
    } else {
      throw new Error("API server returned error; no details provided");
    }
  }

  delete item.error;
}

// Endpoint: GET /misc/amisuperuser

//export interface AmISuperuserRequest { }

export const AmISuperuserResponse = t.type({
  result: t.boolean,
});

export type AmISuperuserResponseT = t.TypeOf<typeof AmISuperuserResponse>;

export async function amISuperuser(fetcher: $Fetch): Promise<AmISuperuserResponseT> {
  return fetcher("/misc/amisuperuser").then((data) => {
    checkForError(data);

    const maybe = AmISuperuserResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`GET /misc/amisuperuser: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  });
}

// Endpoint: POST /misc/config-database

//export interface MiscConfigDatabaseRequest { }

export const MiscConfigDatabaseResponse = t.type({});

export type MiscConfigDatabaseResponseT = t.TypeOf<typeof MiscConfigDatabaseResponse>;

export async function miscConfigDatabase(fetcher: $Fetch): Promise<MiscConfigDatabaseResponseT> {
  return fetcher("/misc/config-database", { method: 'POST' }).then((data) => {
    checkForError(data);

    const maybe = MiscConfigDatabaseResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`GET /misc/config-database: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  });
}

// Endpoint: GET /handle/:handle

export const GetHandleResponse = t.type({
  handle: t.string,
  display_name: t.string,
});

export type GetHandleResponseT = t.TypeOf<typeof GetHandleResponse>;

// Returns null if a 404 is returned, i.e. the handle is not found.
export async function getHandle(fetcher: $Fetch, handle: string): Promise<GetHandleResponseT | null> {
  try {
    const data = await fetcher(`/handle/${encodeURIComponent(handle)}`);
    checkForError(data);

    const maybe = GetHandleResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`GET /handle/:handle: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  } catch (err: any) {
    // As far as I can tell, this is the only way to probe the HTTP response code in the FetchError???
    if (typeof err.message === "string" && err.message.includes("404")) {
      return null;
    }

    throw err;
  }
}

// Endpoint: POST /handle/:handle

export const HandleCreateRequest = t.type({
  display_name: t.string,
});

export type HandleCreateRequestT = t.TypeOf<typeof HandleCreateRequest>;

export const HandleCreateResponse = t.type({
  id: t.string,
});

export type HandleCreateResponseT = t.TypeOf<typeof HandleCreateResponse>;

export async function createHandle(fetcher: $Fetch, handle: string, req: HandleCreateRequestT): Promise<HandleCreateResponseT> {
  const path = `/handle/${encodeURIComponent(handle)}`;

  return fetcher(path, { method: 'POST', body: req }).then((data) => {
    checkForError(data);

    const maybe = HandleCreateResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`POST /handle/:handle: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  });
}

// Endpoint: POST /handle/:handle/add-owner

export const HandleAddOwnerRequest = t.type({
  account_id: t.string,
});

export type HandleAddOwnerRequestT = t.TypeOf<typeof HandleAddOwnerRequest>;

export const HandleAddOwnerResponse = t.type({});

export type HandleAddOwnerResponseT = t.TypeOf<typeof HandleAddOwnerResponse>;

export async function addHandleOwner(
  fetcher: $Fetch,
  handle: string,
  req: HandleAddOwnerRequestT
): Promise<HandleAddOwnerResponseT> {
  const path = `/handle/${encodeURIComponent(handle)}/add-owner`;

  return fetcher(path, { method: 'POST', body: req }).then((data) => {
    checkForError(data);

    const maybe = HandleAddOwnerResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`POST /handle/:handle/add-owner: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  });
}

// Endpoint: GET /scene/:id

export const GetSceneResponse = t.type({
  id: t.string,
  handle_id: t.string,
  handle: GetHandleResponse,
  creation_date: t.string,
  likes: t.number,
  place: PlaceDetails,
  text: t.string,
  outgoing_url: t.union([t.string, t.undefined]),
});

export type GetSceneResponseT = t.TypeOf<typeof GetSceneResponse>;

// Returns null if a 404 is returned, i.e. the scene is not found.
export async function getScene(fetcher: $Fetch, scene_id: string): Promise<GetSceneResponseT | null> {
  try {
    const data = await fetcher(`/scene/${encodeURIComponent(scene_id)}`);
    checkForError(data);
    const maybe = GetSceneResponse.decode(data);

    if (isLeft(maybe)) {
      throw new Error(`GET /scene/:id: API response did not match schema: ${PathReporter.report(maybe).join("\n")}`);
    }

    return maybe.right;
  } catch (err: any) {
    // As far as I can tell, this is the only way to probe the HTTP response code in the FetchError???
    if (typeof err.message === "string" && err.message.includes("404")) {
      return null;
    }

    throw err;
  }
}
