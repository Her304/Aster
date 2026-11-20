"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Flower } from "@/lib/bloom";
import { useBloomCopy, type BloomKey } from "@/lib/bloom-i18n";
import { plantingOrder, plotSize, seed } from "@/lib/garden";
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

/*
 * Isometric geometry, in SVG units. A tile is 2U wide and U tall; the plot
 * is SIZE × SIZE tiles with room above for the flowers and soil below.
 */
const U = 40;
const HEADROOM = 1.8 * U;
const SOIL = 0.75 * U;
const MARGIN = 0.45 * U;
const FLOWER_WIDTH = 1.3 * U;

/**
 * The initiator's garden: a small isometric plot where every person who has
 * answered plants one painted aster. Choosing a flower opens a note above it
 * with that person's name and the type they chose.
 */
export function Garden({ plants }: { plants: readonly GardenPlant[] }) {
  const b = useBloomCopy();
  const [openId, setOpenId] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  const size = plotSize(plants.length);
  const width = 2 * size * U + 2 * MARGIN;
  const height = HEADROOM + size * U + SOIL + 0.3 * U;
  const centre = (row: number, col: number) => ({
    x: MARGIN + (col - row + size) * U,
    y: HEADROOM + ((col + row + 1) * U) / 2,
  });

  const placed = useMemo(() => {
    const order = plantingOrder(plotSize(plants.length));
    return plants.map((plant, index) => {
      const [row, col] = order[index];
      return { plant, row, col, value: seed(plant.id) };
    });
  }, [plants]);
  const taken = new Set(placed.map(({ row, col }) => `${row}:${col}`));

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

  // Keep the note inside the card when its flower stands near an edge.
  useLayoutEffect(() => {
    setShift(0);
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => {
      const card = cardRef.current?.getBoundingClientRect();
      const note = noteRef.current?.getBoundingClientRect();
      if (!card || !note) return;
      const inset = 12;
      if (note.left < card.left + inset) setShift(card.left + inset - note.left);
      else if (note.right > card.right - inset) setShift(card.right - inset - note.right);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openId]);

  const top = { x: MARGIN + size * U, y: HEADROOM };
  const right = { x: MARGIN + 2 * size * U, y: HEADROOM + (size * U) / 2 };
  const bottom = { x: MARGIN + size * U, y: HEADROOM + size * U };
  const left = { x: MARGIN, y: HEADROOM + (size * U) / 2 };
  const point = (p: { x: number; y: number }, dy = 0) => `${p.x},${p.y + dy}`;
  const turf = 0.24 * U;
  const fringe = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const steps = size * 6;
    const points: string[] = [];
    for (let step = steps; step >= 0; step -= 1) {
      const t = step / steps;
      const dip = step % 2 === 0 ? turf : turf * 0.55;
      points.push(`${from.x + (to.x - from.x) * t},${from.y + (to.y - from.y) * t + dip}`);
    }
    return points.join(" ");
  };

  return (
    <section className="bloom-card garden-card" ref={cardRef}>
      <div className="garden-heading">
        <h2 className="card-title">{b("garden.title")}</h2>
        <p>{plants.length ? b("garden.body") : b("garden.empty")}</p>
      </div>
      <div className="garden-plot" style={{ aspectRatio: `${width} / ${height}`, maxWidth: `${size * 118}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <filter id="garden-wash" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="3" />
            </filter>
          </defs>
          <g filter="url(#garden-wash)">
            <polygon points={[point(left), point(bottom), point(bottom, SOIL), point(left, SOIL)].join(" ")} className="soil-left" />
            <polygon points={[point(bottom), point(right), point(right, SOIL), point(bottom, SOIL)].join(" ")} className="soil-right" />
            <polygon points={`${point(left)} ${point(bottom)} ${fringe(left, bottom)}`} className="turf-left" />
            <polygon points={`${point(bottom)} ${point(right)} ${fringe(bottom, right)}`} className="turf-right" />
            <polygon points={[point(top), point(right), point(bottom), point(left)].join(" ")} className="top" />
            {Array.from({ length: size * size }, (_, index) => {
              const row = Math.floor(index / size);
              const col = index % size;
              const { x, y } = centre(row, col);
              return (
                <polygon
                  key={index}
                  points={`${x},${y - U / 2} ${x + U},${y} ${x},${y + U / 2} ${x - U},${y}`}
                  className={(row + col) % 2 ? "tile alt" : "tile"}
                />
              );
            })}
          </g>
          {Array.from({ length: size * size }, (_, index) => {
            const row = Math.floor(index / size);
            const col = index % size;
            if (taken.has(`${row}:${col}`) || seed(`tuft:${row}:${col}`) % 3 !== 0) return null;
            const { x, y } = centre(row, col);
            const dx = ((seed(`dx:${row}:${col}`) % 9) - 4) * 2;
            return (
              <g key={`tuft-${index}`} className="tuft">
                <path d={`M${x + dx - 5},${y + 3} q-1,-7 -4,-10`} />
                <path d={`M${x + dx},${y + 4} q0,-8 1,-13`} />
                <path d={`M${x + dx + 5},${y + 3} q1,-6 5,-9`} />
              </g>
            );
          })}
          {placed.map(({ plant, row, col }) => {
            const { x, y } = centre(row, col);
            return <ellipse key={`shade-${plant.id}`} cx={x} cy={y + 2} rx={0.42 * U} ry={0.16 * U} className="bed" />;
          })}
        </svg>
        <ul className="garden-plants">
          {placed.map(({ plant, row, col, value }, index) => {
            const { x, y } = centre(row, col);
            const jitter = ((value >> 12) % 7) - 3;
            const open = openId === plant.id;
            const noteId = `plant-note-${plant.id}`;
            const style = {
              left: `${((x + jitter) / width) * 100}%`,
              top: `${((y + 0.25 * U) / height) * 100}%`,
              width: `${((FLOWER_WIDTH * (0.9 + ((value >> 4) % 5) * 0.05)) / width) * 100}%`,
              zIndex: open ? 100 : row + col + 1,
              "--tilt": `${((value % 9) - 4) * 1.1}deg`,
              "--delay": `${Math.min(index, 24) * 45}ms`,
            } as CSSProperties;
            return (
              <li key={plant.id} className={`plant${open ? " open" : ""}`} style={style}>
                <button
                  type="button"
                  aria-label={b("garden.label", { name: plant.name })}
                  aria-expanded={open}
                  aria-controls={open ? noteId : undefined}
                  onClick={() => setOpenId(open ? null : plant.id)}
                >
                  <Image src={ASTERS[value % ASTERS.length]} alt="" sizes="120px" draggable={false} />
                </button>
                {open && (
                  <div className="plant-note" id={noteId} role="status" ref={noteRef} style={{ "--shift": `${shift}px` } as CSSProperties}>
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
      </div>
    </section>
  );
}
