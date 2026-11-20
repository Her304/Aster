"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Flower } from "@/lib/bloom";
import { useBloomCopy, type BloomKey } from "@/lib/bloom-i18n";
import aster01 from "@/images/garden/aster-01.webp";
import aster02 from "@/images/garden/aster-02.webp";
import aster03 from "@/images/garden/aster-03.webp";
import aster04 from "@/images/garden/aster-04.webp";
import aster05 from "@/images/garden/aster-05.webp";
import aster06 from "@/images/garden/aster-06.webp";
import aster07 from "@/images/garden/aster-07.webp";
import aster08 from "@/images/garden/aster-08.webp";
import aster09 from "@/images/garden/aster-09.webp";
import aster10 from "@/images/garden/aster-10.webp";
import aster11 from "@/images/garden/aster-11.webp";
import aster12 from "@/images/garden/aster-12.webp";

const ASTERS: readonly StaticImageData[] = [
  aster01, aster02, aster03, aster04, aster05, aster06,
  aster07, aster08, aster09, aster10, aster11, aster12,
];

export interface GardenPlant {
  id: string;
  name: string;
  relation: string;
  type: string;
  flower: Flower | null;
}

/** A stable number from a response id, so each person keeps the same aster and pose. */
function seed(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The initiator's garden: one painted aster for every person who has
 * answered, planted in the order they answered. Choosing a flower opens a
 * small note above it with that person's name and the type they chose.
 */
export function Garden({ plants }: { plants: readonly GardenPlant[] }) {
  const b = useBloomCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const bedRef = useRef<HTMLUListElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!openId) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".plant")) setOpenId(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [openId]);

  useEffect(() => {
    if (openId && !plants.some((plant) => plant.id === openId)) setOpenId(null);
  }, [openId, plants]);

  // Keep the note inside the garden when its flower stands near an edge.
  useLayoutEffect(() => {
    setShift(0);
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => {
      const bed = bedRef.current?.getBoundingClientRect();
      const bubble = bubbleRef.current?.getBoundingClientRect();
      if (!bed || !bubble) return;
      if (bubble.left < bed.left) setShift(bed.left - bubble.left);
      else if (bubble.right > bed.right) setShift(bed.right - bubble.right);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openId]);

  return (
    <section className="bloom-card garden-card">
      <div className="garden-heading">
        <h2 className="card-title">{b("garden.title")}</h2>
        <p>{plants.length ? b("garden.body") : b("garden.empty")}</p>
      </div>
      <ul className={`garden-bed${plants.length ? "" : " empty"}`} ref={bedRef}>
        {plants.map((plant, index) => {
          const value = seed(plant.id);
          const open = openId === plant.id;
          const bubbleId = `plant-note-${plant.id}`;
          const style = {
            "--tilt": `${((value % 11) - 5) * 0.9}deg`,
            "--scale": 0.86 + ((value >> 4) % 7) * 0.035,
            "--lift": `${(value >> 8) % 12}px`,
            "--delay": `${Math.min(index, 20) * 45}ms`,
          } as CSSProperties;
          return (
            <li key={plant.id} className={`plant${open ? " open" : ""}`} style={style}>
              <button
                type="button"
                aria-label={b("garden.label", { name: plant.name })}
                aria-expanded={open}
                aria-controls={open ? bubbleId : undefined}
                onClick={() => setOpenId(open ? null : plant.id)}
              >
                <Image src={ASTERS[value % ASTERS.length]} alt="" sizes="96px" draggable={false} />
              </button>
              {open && (
                <div
                  className="plant-note"
                  id={bubbleId}
                  role="status"
                  ref={bubbleRef}
                  style={{ "--shift": `${shift}px` } as CSSProperties}
                >
                  <strong>{plant.name}</strong>
                  <small>{b(`rel.${plant.relation}` as BloomKey)}</small>
                  <span className="plant-sees">{b("garden.sees")}</span>
                  <b>{plant.type}</b>
                  {plant.flower && <span className="flower-tag">{b(`flower.name.${plant.flower}`)}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
