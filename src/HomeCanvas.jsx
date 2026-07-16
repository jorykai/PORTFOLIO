import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ScrollControls } from '@react-three/drei'
import Carousel from './Carousel'

export default function HomeCanvas({
  filter,
  scrollPages,
  visibleProjects,
  runtimeById,
  onRuntimeChange,
  onReady,
  openingProjectId,
  onRegisterProjectRectGetter,
  onHoveredProjectChange,
  onSelect,
  onActiveIndexChange,
  onScrollProgress,
  onLineFocusChange,
  onLineHitIndexChange,
  onRulerPositionsChange,
  filterWipeRef,
}) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 35 }} className="app-canvas">
      <Suspense fallback={null}>
        <ambientLight intensity={1} />
        <ScrollControls key={filter} horizontal pages={scrollPages} damping={0.08}>
          <Carousel
            visibleProjects={visibleProjects}
            runtimeById={runtimeById}
            onRuntimeChange={onRuntimeChange}
            onReady={onReady}
            openingProjectId={openingProjectId}
            onRegisterProjectRectGetter={onRegisterProjectRectGetter}
            onHoveredProjectChange={onHoveredProjectChange}
            onSelect={onSelect}
            onActiveIndexChange={onActiveIndexChange}
            onScrollProgress={onScrollProgress}
            onLineFocusChange={onLineFocusChange}
            onLineHitIndexChange={onLineHitIndexChange}
            onRulerPositionsChange={onRulerPositionsChange}
            filterWipeRef={filterWipeRef}
          />
        </ScrollControls>
      </Suspense>
    </Canvas>
  )
}
