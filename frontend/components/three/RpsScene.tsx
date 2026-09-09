"use client";

// Scène 3D pierre-feuille-ciseaux : formes procédurales, révélation animée de la dernière manche.

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group } from "three";

import type { RpsMove, RpsState } from "@/lib/api";

const REVEAL_MS = 700;
const MOVES: RpsMove[] = ["rock", "paper", "scissors"];

type Props = { state: RpsState; busy: boolean; onPick: (move: RpsMove) => void };

function Shape({ move, color }: { move: RpsMove; color: string }) {
  if (move === "rock") {
    return (
      <mesh castShadow>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    );
  }
  if (move === "paper") {
    return (
      <mesh castShadow rotation={[-Math.PI / 2.6, 0, 0]}>
        <planeGeometry args={[0.8, 1.0]} />
        <meshStandardMaterial color={color} side={2} />
      </mesh>
    );
  }
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 5]}>
        <boxGeometry args={[0.12, 1.1, 0.06]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh castShadow rotation={[0, 0, -Math.PI / 5]}>
        <boxGeometry args={[0.12, 1.1, 0.06]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

type PickableProps = {
  move: RpsMove;
  position: [number, number, number];
  interactive: boolean;
  onPick: () => void;
};

function Pickable({ move, position, interactive, onPick }: PickableProps) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<Group>(null);

  useFrame((clock) => {
    const node = group.current;
    if (node === null) return;
    node.rotation.y = clock.clock.elapsedTime * 0.6;
    const targetScale = hovered && interactive ? 1.2 : 1;
    node.scale.setScalar(node.scale.x + (targetScale - node.scale.x) * 0.15);
  });

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (interactive) onPick();
      }}
    >
      <Shape move={move} color={hovered && interactive ? "#fb923c" : "#d9bd8f"} />
    </group>
  );
}

/** Une main en pleine révélation : secoue puis montre la forme jouée. */
function Hand({
  move,
  position,
  revealedAt,
  winner,
}: {
  move: RpsMove;
  position: [number, number, number];
  revealedAt: number;
  winner: boolean;
}) {
  const group = useRef<Group>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), REVEAL_MS);
    return () => {
      clearTimeout(timer);
      setRevealed(false);
    };
  }, [revealedAt]);

  useFrame((clock) => {
    const node = group.current;
    if (node === null) return;
    const t = clock.clock.elapsedTime;
    node.position.y = revealed ? 0.6 : 0.6 + Math.abs(Math.sin(t * 14)) * 0.4;
    const targetScale = revealed && winner ? 1.35 : 1;
    node.scale.setScalar(node.scale.x + (targetScale - node.scale.x) * 0.1);
  });

  return (
    <group ref={group} position={position}>
      <Shape move={revealed ? move : "rock"} color={revealed && winner ? "#fb923c" : "#e5d3ae"} />
    </group>
  );
}

export function RpsScene({ state, busy, onPick }: Props) {
  const last = state.rounds.at(-1);
  const interactive = !busy && !state.finished;
  // Une nouvelle manche relance la révélation ; l'index de manche sert d'horodatage stable.
  const revealedAt = state.rounds.length;

  return (
    <div
      aria-hidden="true"
      className="border-border bg-surface h-72 w-full overflow-hidden rounded-lg border"
      data-testid="rps-scene"
    >
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.5, 6], fov: 40 }}>
        <color attach="background" args={["#e8e4da"]} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[3, 8, 4]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#7c8b6f" />
        </mesh>

        {last && (
          <>
            <Hand
              move={last.player}
              position={[-1.6, 0, -0.8]}
              revealedAt={revealedAt}
              winner={last.outcome === "win"}
            />
            <Hand
              move={last.ai}
              position={[1.6, 0, -0.8]}
              revealedAt={revealedAt}
              winner={last.outcome === "loss"}
            />
          </>
        )}

        {MOVES.map((move, i) => (
          <Pickable
            key={move}
            move={move}
            position={[(i - 1) * 1.6, 0.6, 1.8]}
            interactive={interactive}
            onPick={() => onPick(move)}
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
