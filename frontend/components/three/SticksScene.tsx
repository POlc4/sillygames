"use client";

// Scène 3D des bâtonnets (React Three Fiber). Purement visuelle : reçoit l'état, émet onTake.
// Les retraits sont animés en deux temps (coup du joueur, puis réponse de l'IA).

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";

import type { Move, SticksState } from "@/lib/api";

import { highlightedIndices, stickPositions, takeCountForHover, type Vec3 } from "./sticksLayout";

const PHASE_MS = 650;

type LastMove = Pick<Move, "player_move" | "ai_move"> | undefined;

type Props = {
  state: SticksState;
  lastMove?: LastMove;
  busy: boolean;
  onTake: (count: number) => void;
};

type StickProps = {
  position: Vec3;
  highlighted: boolean;
  leaving: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onClick: () => void;
};

function Stick({ position, highlighted, leaving, interactive, onHover, onClick }: StickProps) {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    const node = group.current;
    if (node === null || !leaving) return;
    node.position.y -= delta * 3;
    node.rotation.z += delta * 4;
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (interactive) onHover(true);
      }}
      onPointerOut={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (interactive) onClick();
      }}
    >
      <mesh castShadow position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 10]} />
        <meshStandardMaterial color={highlighted ? "#fb923c" : "#d9bd8f"} />
      </mesh>
      <mesh castShadow position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial color={highlighted ? "#ea580c" : "#7f1d1d"} />
      </mesh>
    </group>
  );
}

/**
 * Nombre de bâtonnets affichés, en retard sur l'état réel le temps des animations.
 * Toutes les mises à jour d'état passent par des timers (règle react-hooks/set-state-in-effect).
 */
function useAnimatedCount(target: number, lastMove: LastMove) {
  const [shown, setShown] = useState(target);
  const [leaving, setLeaving] = useState<number[]>([]);
  const shownRef = useRef(target);

  useEffect(() => {
    const current = shownRef.current;
    const steps = [Number(lastMove?.player_move ?? 0), Number(lastMove?.ai_move ?? 0)];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const apply = (count: number) => {
      shownRef.current = count;
      setShown(count);
      setLeaving([]);
    };

    if (current <= target || steps[0] + steps[1] !== current - target) {
      // Nouvelle partie ou état inattendu : pas d'animation.
      timers.push(setTimeout(() => apply(target), 0));
    } else {
      let at = current;
      let delay = 0;
      for (const count of steps.filter((n) => n > 0)) {
        const from = at;
        timers.push(setTimeout(() => setLeaving(highlightedIndices(count, from)), delay));
        delay += PHASE_MS;
        at -= count;
        const to = at;
        timers.push(setTimeout(() => apply(to), delay));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [target, lastMove]);

  return { shown, leaving };
}

export function SticksScene({ state, lastMove, busy, onTake }: Props) {
  const { shown, leaving } = useAnimatedCount(state.sticks, lastMove);
  const [hovered, setHovered] = useState<number | null>(null);
  const positions = useMemo(() => stickPositions(shown), [shown]);

  const interactive =
    !busy && !state.finished && state.current === "player" && shown === state.sticks;
  const hoverCount = hovered === null ? 0 : takeCountForHover(hovered, shown, state.legal_moves);
  const highlighted = new Set(highlightedIndices(hoverCount, shown));
  const leavingSet = new Set(leaving);

  return (
    <div
      aria-hidden="true"
      className="border-border bg-surface h-72 w-full overflow-hidden rounded-lg border"
      data-testid="sticks-scene"
    >
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 4.5, 6], fov: 40 }}>
        <color attach="background" args={["#e8e4da"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[4, 8, 3]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#9a7b4f" />
        </mesh>
        {positions.map((position, i) => (
          <Stick
            key={i}
            position={position}
            highlighted={highlighted.has(i)}
            leaving={leavingSet.has(i)}
            interactive={interactive}
            onHover={(hovering) => setHovered(hovering ? i : null)}
            onClick={() => {
              const count = takeCountForHover(i, shown, state.legal_moves);
              if (count > 0) {
                setHovered(null);
                onTake(count);
              }
            }}
          />
        ))}
        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  );
}
