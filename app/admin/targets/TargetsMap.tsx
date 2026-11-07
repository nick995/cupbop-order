"use client";

// Google Maps for /admin/targets: a map with a pin per target, plus a place
// search that fills the "Add a place" form. Without an API key the map is
// hidden and the form is filled in by hand.

import { useEffect, useRef, useState } from "react";
import {
  CateringTarget,
  STORE_LOCATION,
  TARGET_STATUS_COLORS,
  directionsUrl,
} from "@/lib/targets";
import { addTarget } from "../actions";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    __cupbopMapsReady?: () => void;
  }
}

let mapsPromise: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string): Promise<any> {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    window.__cupbopMapsReady = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: "__cupbopMapsReady",
    })}`;
    script.async = true;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

interface PickedPlace {
  name: string;
  address: string;
  phone: string;
  website: string;
  place_id: string;
  lat: string;
  lng: string;
}

const EMPTY_PLACE: PickedPlace = { name: "", address: "", phone: "", website: "", place_id: "", lat: "", lng: "" };

export default function TargetsMap({
  apiKey,
  targets,
  owner,
}: {
  apiKey: string | null;
  targets: CateringTarget[];
  owner: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [place, setPlace] = useState<PickedPlace>(EMPTY_PLACE);

  // Map + search box, created once.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      try {
        const maps = await loadGoogleMaps(apiKey);
        const [{ Map }, places] = await Promise.all([maps.importLibrary("maps"), maps.importLibrary("places")]);
        if (cancelled || !mapEl.current || !searchEl.current) return;

        mapRef.current = new Map(mapEl.current, {
          center: STORE_LOCATION,
          zoom: 11,
          mapId: "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: false,
        });

        const autocomplete = new places.PlaceAutocompleteElement({
          locationBias: { center: STORE_LOCATION, radius: 50_000 },
        });
        autocomplete.style.width = "100%";
        searchEl.current.replaceChildren(autocomplete);

        const onPick = async (picked: any) => {
          if (!picked) return;
          await picked.fetchFields({
            fields: ["id", "displayName", "formattedAddress", "location", "nationalPhoneNumber", "websiteURI"],
          });
          setPlace({
            name: picked.displayName ?? "",
            address: picked.formattedAddress ?? "",
            phone: picked.nationalPhoneNumber ?? "",
            website: picked.websiteURI ?? "",
            place_id: picked.id ?? "",
            lat: picked.location ? String(picked.location.lat()) : "",
            lng: picked.location ? String(picked.location.lng()) : "",
          });
          if (picked.location) {
            mapRef.current?.panTo(picked.location);
            mapRef.current?.setZoom(15);
          }
        };
        // Newer API fires gmp-select with a prediction; older fires gmp-placeselect with a place.
        autocomplete.addEventListener("gmp-select", (e: any) => onPick(e.placePrediction?.toPlace()));
        autocomplete.addEventListener("gmp-placeselect", (e: any) => onPick(e.place));
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError("Google Maps couldn't load. Check the API key and that Maps JavaScript API + Places API (New) are enabled.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Pins, refreshed whenever the list changes.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    (async () => {
      const maps = await loadGoogleMaps(apiKey).catch(() => null);
      if (!maps || cancelled) return;
      const [{ AdvancedMarkerElement, PinElement }, { InfoWindow }] = await Promise.all([
        maps.importLibrary("marker"),
        maps.importLibrary("maps"),
      ]);
      // The map may still be initializing in the other effect.
      for (let i = 0; i < 50 && !mapRef.current && !cancelled; i++) await new Promise((r) => setTimeout(r, 100));
      if (cancelled || !mapRef.current) return;

      markersRef.current.forEach((m) => (m.map = null));
      const info = new InfoWindow();
      markersRef.current = targets
        .filter((t) => t.lat != null && t.lng != null)
        .map((t) => {
          const color = TARGET_STATUS_COLORS[t.status].hex;
          const pin = new PinElement({ background: color, borderColor: "#000", glyphColor: "#fff" });
          const marker = new AdvancedMarkerElement({
            map: mapRef.current,
            position: { lat: t.lat, lng: t.lng },
            title: t.name,
            content: pin.element,
            gmpClickable: true,
          });
          marker.addListener("click", () => {
            const box = document.createElement("div");
            box.style.fontSize = "13px";
            const title = document.createElement("strong");
            title.textContent = t.name;
            const status = document.createElement("div");
            status.textContent = t.status;
            status.style.color = color;
            const link = document.createElement("a");
            link.href = directionsUrl(t);
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "Directions →";
            const jump = document.createElement("a");
            jump.href = `/admin/targets/${t.id}`;
            jump.textContent = "Open";
            jump.style.marginLeft = "10px";
            box.append(title, status, link, jump);
            info.setContent(box);
            info.open({ map: mapRef.current, anchor: marker });
          });
          return marker;
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, targets]);

  const field = (key: keyof PickedPlace) => ({
    name: key,
    value: place[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPlace((p) => ({ ...p, [key]: e.target.value })),
  });

  return (
    <>
      {apiKey && !loadError && (
        <div ref={mapEl} className="mb-4 h-72 w-full overflow-hidden rounded-2xl border-2 border-black bg-gray-100 sm:h-96" />
      )}
      {loadError && (
        <p className="mb-4 rounded-xl border-2 border-black bg-red-100 px-4 py-3 text-sm font-bold text-red-900">{loadError}</p>
      )}
      {!apiKey && (
        <p className="mb-4 rounded-xl border-2 border-dashed border-gray-400 px-4 py-3 text-sm text-gray-600">
          Map and place search turn on once <code>GOOGLE_MAPS_API_KEY</code> is set. You can still add places by hand.
        </p>
      )}

      <details className="group mb-4 rounded-2xl border-2 border-black bg-white p-4 shadow-[0_3px_0_#000]">
        <summary className="cursor-pointer select-none list-none text-center text-base font-extrabold [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">+ Add a place to {owner}’s list</span>
          <span className="hidden group-open:inline">Add a place to {owner}’s list</span>
        </summary>
        {apiKey && !loadError && (
          <div className="mt-2">
            <span className="mb-1 block text-xs font-bold">Search Google Maps</span>
            <div ref={searchEl} className="min-h-10" />
          </div>
        )}
        <form action={addTarget} onSubmit={() => setTimeout(() => setPlace(EMPTY_PLACE), 0)} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input type="hidden" name="owner" value={owner} />
          <input type="hidden" {...field("place_id")} />
          <input type="hidden" {...field("lat")} />
          <input type="hidden" {...field("lng")} />
          <TextInput label="Name" required {...field("name")} />
          <TextInput label="Phone" {...field("phone")} />
          <TextInput label="Address" className="sm:col-span-2" {...field("address")} />
          <TextInput label="Website" className="sm:col-span-2" {...field("website")} />
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">Notes</span>
            <textarea name="notes" rows={2} placeholder="Who to talk to, team size, best time to visit…" className="w-full resize-none rounded-xl border-2 border-black px-3 py-2 text-sm" />
          </label>
          <button className="rounded-xl border-2 border-black bg-[#FFD200] px-4 py-2 text-sm font-bold shadow-[0_3px_0_#000] active:translate-y-0.5 active:shadow-none sm:col-span-2">
            Add to list
          </button>
        </form>
      </details>
    </>
  );
}

function TextInput({
  label,
  className = "",
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input {...props} className="w-full rounded-xl border-2 border-black px-3 py-2 text-sm" />
    </label>
  );
}
