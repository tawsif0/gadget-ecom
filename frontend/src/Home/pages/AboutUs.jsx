import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import usePublicSettings from "../../hooks/usePublicSettings";
import { hasHtmlContent } from "../../utils/richText";
import {
  DEFAULT_ABOUT_CARDS,
  DEFAULT_ABOUT_STORY_CONTENT,
  DEFAULT_ABOUT_STORY_TITLE,
  getAboutCardIconComponent,
  normalizeAboutCards,
} from "../../utils/aboutSection";

const Wheel = ({ position }) => (
  <group position={position} rotation={[Math.PI / 2, 0, 0]}>
    <mesh castShadow>
      <cylinderGeometry args={[0.26, 0.26, 0.18, 28]} />
      <meshStandardMaterial color="#0b0f19" roughness={0.55} metalness={0.2} />
    </mesh>
    <mesh castShadow>
      <cylinderGeometry args={[0.18, 0.18, 0.12, 24]} />
      <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.6} />
    </mesh>
    <mesh castShadow>
      <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
      <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.5} />
    </mesh>
  </group>
);

const TruckModel = () => {
  return (
    <group position={[-0.4, 0.26, 0]}>
      {/* Trailer */}
      <RoundedBox
        args={[3.5, 1.2, 1.5]}
        radius={0.08}
        smoothness={10}
        position={[1.05, 0.55, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#f8fafc"
          roughness={0.25}
          metalness={0.15}
          clearcoat={0.4}
          clearcoatRoughness={0.4}
        />
      </RoundedBox>
      {/* Trailer panel */}
      {/* Chassis */}
      <RoundedBox
        args={[4.4, 0.18, 0.6]}
        radius={0.06}
        smoothness={6}
        position={[0.6, 0.18, 0]}
        castShadow
      >
        <meshStandardMaterial
          color="#111827"
          roughness={0.55}
          metalness={0.2}
        />
      </RoundedBox>
      {/* Cab */}
      <RoundedBox
        args={[1.2, 0.85, 1.45]}
        radius={0.1}
        smoothness={10}
        position={[-1.35, 0.45, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#2563eb"
          roughness={0.35}
          metalness={0.35}
          clearcoat={0.5}
          clearcoatRoughness={0.35}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.8, 0.32, 1.38]}
        radius={0.08}
        smoothness={8}
        position={[-1.2, 0.9, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#1d4ed8"
          roughness={0.38}
          metalness={0.32}
          clearcoat={0.45}
          clearcoatRoughness={0.35}
        />
      </RoundedBox>
      {/* Windshield */}
      <RoundedBox
        args={[0.22, 0.35, 0.55]}
        radius={0.06}
        smoothness={6}
        position={[-1.68, 0.48, 0.35]}
        castShadow
      >
        <meshPhysicalMaterial
          color="#dbeafe"
          roughness={0.02}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transmission={0.2}
        />
      </RoundedBox>
      {/* Grill */}
      <RoundedBox
        args={[0.14, 0.3, 0.7]}
        radius={0.04}
        smoothness={6}
        position={[-1.86, 0.28, 0]}
        castShadow
      >
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      {/* Headlights */}
      {[
        [-1.83, 0.3, 0.48],
        [-1.83, 0.3, -0.48],
      ].map((pos) => (
        <RoundedBox
          key={pos.join("-")}
          args={[0.06, 0.1, 0.18]}
          radius={0.02}
          smoothness={4}
          position={pos}
          castShadow
        >
          <meshStandardMaterial
            color="#fef3c7"
            emissive="#facc15"
            emissiveIntensity={0.6}
          />
        </RoundedBox>
      ))}
      {/* Side mirror */}
      <mesh position={[-1.55, 0.7, 0.8]} castShadow>
        <boxGeometry args={[0.22, 0.08, 0.04]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Rear door (open) */}
      <RoundedBox
        args={[0.06, 1.1, 1.3]}
        radius={0.04}
        smoothness={6}
        position={[2.75, 0.55, 0.72]}
        rotation={[0, Math.PI / 2.2, 0]}
        castShadow
      >
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.1} />
      </RoundedBox>
      {/* Bumper */}
      <RoundedBox
        args={[0.2, 0.14, 1.2]}
        radius={0.03}
        smoothness={6}
        position={[-2.0, 0.1, 0]}
        castShadow
      >
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* Wheels */}
      {[
        [-1.3, 0.0, 0.78],
        [-1.3, 0.0, -0.78],
        [1.0, 0.0, 0.78],
        [1.0, 0.0, -0.78],
        [2.2, 0.0, 0.78],
        [2.2, 0.0, -0.78],
      ].map((pos) => (
        <Wheel key={pos.join("-")} position={pos} />
      ))}{" "}
    </group>
  );
};

const Pallet = ({ position, stack = 3 }) => {
  const boxes = useMemo(() => {
    const items = [];
    for (let y = 0; y < stack; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        for (let z = 0; z < 2; z += 1) {
          items.push([x * 0.34 - 0.17, 0.16 + y * 0.22, z * 0.34 - 0.17]);
        }
      }
    }
    return items;
  }, [stack]);

  return (
    <group position={position}>
      <RoundedBox
        args={[0.96, 0.1, 0.76]}
        radius={0.05}
        smoothness={6}
        castShadow
      >
        <meshStandardMaterial color="#c4a484" roughness={0.65} />
      </RoundedBox>
      {boxes.map((pos, index) => (
        <group key={index} position={pos}>
          <RoundedBox
            args={[0.3, 0.2, 0.3]}
            radius={0.04}
            smoothness={4}
            castShadow
          >
            <meshStandardMaterial
              color="#f8fafc"
              roughness={0.35}
              metalness={0.05}
            />
          </RoundedBox>
          <mesh position={[0, 0.02, 0.16]} castShadow>
            <boxGeometry args={[0.22, 0.05, 0.02]} />
            <meshStandardMaterial color="#22c55e" roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const MovingPallet = ({
  startX,
  endX,
  startY = 0,
  endY = 0.21,
  z,
  speed = 0.1,
  offset = 0,
}) => {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * speed + offset) % 1;
    const x = startX + (endX - startX) * t;
    const baseY = startY + (endY - startY) * t;
    const bob = Math.sin((t + offset) * Math.PI * 2) * 0.015;
    if (ref.current) {
      ref.current.position.set(x, baseY + bob, z);
    }
  });

  return (
    <group ref={ref}>
      <Pallet position={[0, 0, 0]} stack={2} />
    </group>
  );
};

const Worker = ({ position, rotation = [0, 0, 0], shirt = "#f59e0b" }) => (
  <group position={position} rotation={rotation}>
    <RoundedBox
      args={[0.36, 0.52, 0.24]}
      radius={0.1}
      smoothness={8}
      position={[0, 0.46, 0]}
      castShadow
    >
      <meshStandardMaterial color={shirt} roughness={0.35} />
    </RoundedBox>
    <mesh position={[0, 0.9, 0]} castShadow>
      <sphereGeometry args={[0.16, 24, 24]} />
      <meshStandardMaterial color="#f3c5a6" roughness={0.4} />
    </mesh>
    <mesh position={[0, 1.02, 0]} castShadow>
      <sphereGeometry args={[0.18, 24, 24]} />
      <meshStandardMaterial color="#facc15" roughness={0.35} />
    </mesh>
    <mesh position={[0.24, 0.52, 0]} castShadow>
      <capsuleGeometry args={[0.06, 0.26, 8, 16]} />
      <meshStandardMaterial color="#f3c5a6" />
    </mesh>
    <mesh position={[-0.24, 0.52, 0]} castShadow>
      <capsuleGeometry args={[0.06, 0.26, 8, 16]} />
      <meshStandardMaterial color="#f3c5a6" />
    </mesh>
    <mesh position={[0.12, 0.15, 0]} castShadow>
      <capsuleGeometry args={[0.07, 0.26, 8, 16]} />
      <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
    </mesh>
    <mesh position={[-0.12, 0.15, 0]} castShadow>
      <capsuleGeometry args={[0.07, 0.26, 8, 16]} />
      <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
    </mesh>
    <RoundedBox
      args={[0.18, 0.18, 0.18]}
      radius={0.04}
      smoothness={4}
      position={[0.34, 0.52, 0]}
      castShadow
    >
      <meshStandardMaterial color="#f8fafc" roughness={0.3} />
    </RoundedBox>
  </group>
);

const DeliveryScene = () => {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="relative z-10 h-[380px] w-full">
        <Canvas
          shadows
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [5.2, 2.6, 5.5], fov: 40 }}
          style={{ height: "100%", width: "100%", background: "transparent" }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <Environment preset="studio" />
          <ambientLight intensity={0.7} />
          <directionalLight
            intensity={1.2}
            position={[5, 6, 4]}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight intensity={0.6} position={[-4, 3, -2]} />

          <group position={[0, 0, 0]}>
            <TruckModel />

            {/* Soft contact shadow */}
            <ContactShadows
              position={[0.6, -0.02, 0]}
              opacity={0.35}
              blur={2.2}
              width={8}
              height={6}
              far={4}
            />

            {/* Static pallets (ground) */}
            <Pallet position={[3.7, 0, 1.0]} stack={3} />
            <Pallet position={[3.7, 0, -1.1]} stack={2} />

            {/* Cargo inside truck */}
            <Pallet position={[1.85, 0.21, 0.35]} stack={2} />
            <Pallet position={[1.85, 0.21, -0.35]} stack={2} />

            {/* Moving pallets into the truck */}
            <MovingPallet
              startX={4.3}
              endX={2.1}
              startY={0}
              endY={0.21}
              z={0.55}
              speed={0.12}
              offset={0.0}
            />
            <MovingPallet
              startX={4.0}
              endX={2.15}
              startY={0}
              endY={0.21}
              z={-0.55}
              speed={0.12}
              offset={0.45}
            />
            <MovingPallet
              startX={4.5}
              endX={2.25}
              startY={0}
              endY={0.21}
              z={0.0}
              speed={0.12}
              offset={0.75}
            />

            {/* Workers */}
            <Worker position={[2.8, 0, 1.6]} rotation={[0, Math.PI / 4, 0]} />
            <Worker
              position={[3.55, 0, -0.2]}
              rotation={[0, -Math.PI / 6, 0]}
              shirt="#fb923c"
            />
            <Worker
              position={[2.6, 0, -1.6]}
              rotation={[0, Math.PI / 2.2, 0]}
              shirt="#f97316"
            />
          </group>

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.9}
            minPolarAngle={0.4}
            maxPolarAngle={1.4}
          />
        </Canvas>
      </div>
    </div>
  );
};

const AboutUs = () => {
  const { settings } = usePublicSettings();
  const storeName =
    String(settings?.website?.storeName || "E-Commerce").trim() || "E-Commerce";
  const tagline = String(settings?.website?.tagline || "").trim();
  const aboutStoryTitle =
    String(settings?.about?.storyTitle || "").trim() ||
    DEFAULT_ABOUT_STORY_TITLE;
  const aboutStorySubtitle = String(
    settings?.about?.storySubtitle || "",
  ).trim();
  const aboutStoryContent =
    String(settings?.about?.storyContent || "").trim() ||
    (tagline
      ? `<p>${tagline}</p><p>${storeName} now brings products, banners, categories, support, compare flows, wishlist behavior, and branded landing content into one office ecommerce system that feels much closer to a full marketplace experience.</p><p>Our mission is simple: give shoppers a more polished buying journey while giving operators a stronger control layer for stock, pricing, orders, and storefront presentation.</p>`
      : DEFAULT_ABOUT_STORY_CONTENT);
  const features = normalizeAboutCards(
    settings?.about?.cards || DEFAULT_ABOUT_CARDS,
  );

  // Admin-controllable stats
  const stats = [
    {
      value: settings?.about?.stat1Value || "99.9%",
      label: settings?.about?.stat1Label || "Uptime Guarantee",
    },
    {
      value: settings?.about?.stat2Value || "50K+",
      label: settings?.about?.stat2Label || "Active Merchants",
    },
    {
      value: settings?.about?.stat3Value || "24/7",
      label: settings?.about?.stat3Label || "Premium Support",
    },
  ];

  return (
    <main
      className="bg-white font-sans antialiased text-slate-900"
      style={{ fontFamily: "var(--brand-font-family)" }}
    >
      {/* BEGIN: Our Story Section */}
      <section className="relative overflow-hidden pt-24 pb-32 lg:pt-24 lg:pb-48">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
            {/* Content Left */}
            <div className="w-full lg:w-3/5 order-2 lg:order-1">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
                Our Mission
              </span>
              <h1 className="mt-2 text-5xl lg:text-7xl font-extrabold mb-12 leading-tight">
                {aboutStoryTitle}
                {aboutStorySubtitle ? (
                  <>
                    <br />
                    <span className="text-slate-400 font-bold">
                      {aboutStorySubtitle}
                    </span>
                  </>
                ) : null}
              </h1>

              <div className="max-w-2xl space-y-8 mb-12">
                {hasHtmlContent(aboutStoryContent) ? (
                  <div
                    className="prose prose-lg max-w-none space-y-6 [&_p]:text-xl [&_p]:leading-relaxed [&_p]:text-slate-600 [&_p]:font-medium"
                    dangerouslySetInnerHTML={{ __html: aboutStoryContent }}
                  />
                ) : (
                  <p className="text-xl leading-relaxed text-slate-600 font-medium">
                    {aboutStoryContent}
                  </p>
                )}
              </div>

              {/* Stats Display */}
              <div className="flex flex-wrap gap-12">
                {stats.map((stat, index) => (
                  <div key={index}>
                    <div className="text-4xl font-extrabold text-slate-900">
                      {stat.value}
                    </div>
                    <p className="text-sm font-semibold text-slate-500 mt-2">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Image Right */}
            <div className="w-full lg:w-2/5 order-1 lg:order-2 flex justify-center items-center">
              <div className="relative group w-full!">
                {/* Decorative blur behind the image for depth */}
                <div className="absolute -inset-4 opacity-50 group-hover:opacity-75 transition-opacity duration-500"></div>
                <div className="relative  transition-transform duration-700">
                  <DeliveryScene />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: Our Story Section */}

      {/* BEGIN: Trust Section */}
      <section className="bg-slate-50 py-24 lg:py-40">
        <div className="container mx-auto px-6 md:px-12">
          {/* Section Header */}
          <div className="mx-auto max-w-3xl mb-20 lg:mb-32 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-8 md:text-4xl lg:text-5xl">
              Shop With Confidence
            </h2>
            <p className="mx-auto text-base text-slate-600 max-w-2xl md:text-lg">
              We&apos;ve built the storefront around trust, clarity, and
              smoother customer decisions to ensure every interaction feels
              premium.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 lg:gap-12">
            {features && features.length > 0
              ? features.map((feature, index) => {
                  const Icon = getAboutCardIconComponent(feature.icon);
                  return (
                    <div
                      key={`${feature.title}-${index}`}
                      className="group bg-white p-10 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-500 border border-slate-100 flex flex-col h-full"
                    >
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:text-white transition-all duration-500"
                        style={{
                          backgroundColor: feature.backgroundColor || "#3B82F6",
                          color: feature.iconColor || "#ffffff",
                        }}
                      >
                        <Icon className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold mb-4 text-slate-900">
                        {feature.title}
                      </h3>
                      {hasHtmlContent(feature.description) ? (
                        <div
                          className="text-slate-500 leading-relaxed [&_p]:text-slate-500 [&_p]:leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: feature.description,
                          }}
                        />
                      ) : (
                        <p className="text-slate-500 leading-relaxed">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      </section>
      {/* END: Trust Section */}
    </main>
  );
};

export default AboutUs;
