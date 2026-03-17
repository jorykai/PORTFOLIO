import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScroll } from '@react-three/drei'
import ImagePlane from './ImagePlane'
import * as THREE from 'three'

const GAP = 0.05
const VIDEO_HEIGHT_DESKTOP = 0.95
const VIDEO_HEIGHT_MOBILE = 0.74

function getDimensions(type, videoHeight) {
  if (type === 'video') {
    return { width: videoHeight * (16 / 9), height: videoHeight }
  }

  return { width: videoHeight * (16 / 9), height: videoHeight }
}

export default function Carousel({
  visibleProjects,
  runtimeById = {},
  openingProjectId = null,
  onSelect,
  onRegisterProjectRectGetter,
  onHoveredProjectChange,
  onActiveIndexChange,
  onScrollProgress,
  onLineFocusChange,
  onLineHitIndexChange,
  onRulerPositionsChange,
  filterWipeRef = null,
}) {
  const groupRef = useRef()
  const dockFocusRefs = useRef([])
  const hoverReleaseTimerRef = useRef(null)
  const scroll = useScroll()
  const lastActiveIndexRef = useRef(-1)
  const lastProgressRef = useRef(-1)
  const lastOffsetRef = useRef(0)
  const lastLineHitIndexRef = useRef(-1)
  const lastLineFocusIndexRef = useRef(-2)
  const lastLineFocusVisibleRef = useRef(false)
  const smoothedSpeedRef = useRef(0)
  const tmpCenterRef = useRef(new THREE.Vector3())
  const tmpLeftRef = useRef(new THREE.Vector3())
  const tmpRightRef = useRef(new THREE.Vector3())
  const [hoveredIndex, setHoveredIndex] = useState(-1)
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.matchMedia('(max-width: 768px)').matches
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobileViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const layout = useMemo(() => {
    const videoHeight = isMobileViewport ? VIDEO_HEIGHT_MOBILE : VIDEO_HEIGHT_DESKTOP
    const withSize = visibleProjects.map((project) => ({
      project,
      ...getDimensions(project.type, videoHeight),
    }))

    const totalWidth =
      withSize.reduce((sum, item) => sum + item.width, 0) +
      Math.max(0, withSize.length - 1) * GAP

    let cursor = -totalWidth / 2
    return withSize.map((item) => {
      const x = cursor + item.width / 2
      cursor += item.width + GAP
      return { ...item, x }
    })
  }, [visibleProjects, isMobileViewport])

  const openingIndex = useMemo(
    () => (openingProjectId ? visibleProjects.findIndex((project) => project.id === openingProjectId) : -1),
    [openingProjectId, visibleProjects]
  )
  const hasOpeningFocus = openingIndex >= 0

  useEffect(() => {
    if (scroll.el) {
      scroll.el.scrollLeft = 0
    }
  }, [visibleProjects, scroll.el])

  useEffect(() => {
    setHoveredIndex(-1)
  }, [visibleProjects])

  useEffect(() => {
    dockFocusRefs.current = visibleProjects.map((_, index) => dockFocusRefs.current[index] || {
      focus: 0,
      lineX: 0.5,
      dNorm: 0,
      speed: 0,
    })
    lastLineHitIndexRef.current = -1
    lastOffsetRef.current = 0
    smoothedSpeedRef.current = 0
  }, [visibleProjects])

  useEffect(() => {
    return () => {
      if (hoverReleaseTimerRef.current) {
        window.clearTimeout(hoverReleaseTimerRef.current)
        hoverReleaseTimerRef.current = null
      }
    }
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current || layout.length === 0) return

    const firstX = layout[0].x
    const lastX = layout[layout.length - 1].x
    const span = Math.max(0.0001, lastX - firstX)
    const targetGroupX = THREE.MathUtils.lerp(-firstX, -lastX, scroll.offset)
    const wipeProgress = filterWipeRef?.current?.progress ?? 0
    const offsetDelta = scroll.offset - lastOffsetRef.current
    const rawSpeed = Math.abs(offsetDelta) / Math.max(delta, 0.0001)
    const targetSpeedNorm = Math.min(1, rawSpeed * 1.7)
    const speedNorm = THREE.MathUtils.lerp(smoothedSpeedRef.current, targetSpeedNorm, 0.18)
    smoothedSpeedRef.current = speedNorm
    lastOffsetRef.current = scroll.offset

    groupRef.current.position.x = targetGroupX
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.14)
    groupRef.current.scale.x = THREE.MathUtils.lerp(
      groupRef.current.scale.x,
      1 + 0.18 * wipeProgress,
      0.14
    )
    groupRef.current.scale.y = THREE.MathUtils.lerp(
      groupRef.current.scale.y,
      1 - 0.03 * wipeProgress,
      0.14
    )
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, 0.14)

    // Per-item line-local data for liquid magnification in the shader.
    const viewportW = window.innerWidth
    const lineProgress = Math.max(0, Math.min(1, scroll.offset))
    const focusX = lineProgress * viewportW
    const radius = viewportW * 0.26
    const sigma = radius * 0.62
    const rulerPositions = onRulerPositionsChange ? new Array(layout.length) : null
    const centerVec = tmpCenterRef.current
    const leftVec = tmpLeftRef.current
    const rightVec = tmpRightRef.current

    layout.forEach((item, index) => {
      const worldX = item.x + groupRef.current.position.x

      centerVec.set(worldX, 0, 0).project(state.camera)
      leftVec.set(worldX - item.width / 2, 0, 0).project(state.camera)
      rightVec.set(worldX + item.width / 2, 0, 0).project(state.camera)

      const itemCenterX = (centerVec.x * 0.5 + 0.5) * viewportW
      const itemLeftX = (leftVec.x * 0.5 + 0.5) * viewportW
      const itemWidthPx = Math.max(1, Math.abs((rightVec.x - leftVec.x) * 0.5 * viewportW))
      const d = itemCenterX - focusX
      const t = THREE.MathUtils.clamp(Math.abs(d) / radius, 0, 1)
      const smooth = 1 - (t * t * (3 - 2 * t))
      const gaussian = Math.exp(-(d * d) / (2 * sigma * sigma))
      const focus = smooth * gaussian
      const dNorm = THREE.MathUtils.clamp(d / radius, -1, 1)
      const lineX = THREE.MathUtils.clamp(0.5 - (d / itemWidthPx), -0.5, 1.5)

      if (dockFocusRefs.current[index]) {
        dockFocusRefs.current[index].focus = focus
        dockFocusRefs.current[index].lineX = lineX
        dockFocusRefs.current[index].dNorm = dNorm
        dockFocusRefs.current[index].speed = speedNorm
      }

      if (rulerPositions) {
        rulerPositions[index] = itemLeftX
      }
    })

    onRulerPositionsChange?.(rulerPositions, focusX)

    // Notify which item the line is currently "on" (desktop title/year source).
    let maxFocus = 0
    let maxIndex = -1
    dockFocusRefs.current.forEach((entry, index) => {
      if (!entry) return
      if (entry.focus > maxFocus) {
        maxFocus = entry.focus
        maxIndex = index
      }
    })
    if (maxIndex !== lastLineHitIndexRef.current) {
      lastLineHitIndexRef.current = maxIndex
      onLineHitIndexChange?.(maxIndex)
    }
    const focusVisible = maxFocus > 0.14
    if (
      maxIndex !== lastLineFocusIndexRef.current ||
      focusVisible !== lastLineFocusVisibleRef.current
    ) {
      lastLineFocusIndexRef.current = maxIndex
      lastLineFocusVisibleRef.current = focusVisible
      onLineFocusChange?.(focusVisible ? maxIndex : -1)
    }

    if (Math.abs(scroll.offset - lastProgressRef.current) > 0.0001) {
      lastProgressRef.current = scroll.offset
    }
    onScrollProgress?.(scroll.offset)

    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY

    layout.forEach((item, index) => {
      const worldX = item.x + groupRef.current.position.x
      const distance = Math.abs(worldX)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    if (closestIndex !== lastActiveIndexRef.current) {
      lastActiveIndexRef.current = closestIndex
      onActiveIndexChange?.(closestIndex)
    }
  })

  return (
    <group ref={groupRef}>
      {layout.map(({ project, width, height, x }, index) => {
        let offsetX = 0
        if (hasOpeningFocus && project.id !== openingProjectId) {
          const distance = Math.abs(index - openingIndex)
          const falloff = Math.max(0.2, 1 - distance * 0.16)
          const direction = index < openingIndex ? -1 : 1
          offsetX = direction * 1.25 * falloff
        }

        if (!hasOpeningFocus && hoveredIndex >= 0 && hoveredIndex !== index) {
          const hoverPush = 0.24
          offsetX += index < hoveredIndex ? -hoverPush : hoverPush
        }

        const openingState = !hasOpeningFocus
          ? 'idle'
          : project.id === openingProjectId
            ? 'focus'
            : 'other'

        return (
        <ImagePlane
          key={project.id}
          projectId={project.id}
          url={project.type === 'video' ? project.poster : project.src}
          videoUrl={project.videoUrl}
          title={project.title}
          year={project.year || '2025'}
          type={project.type}
          runtime={runtimeById[project.id] || '--:--'}
          width={width}
          height={height}
          dockFlowRef={dockFocusRefs.current[index]}
          position={[x, 0, 0]}
          offsetX={offsetX}
          openingState={openingState}
          onClick={(originRect) => onSelect(project, originRect)}
          onRegisterProjectRectGetter={onRegisterProjectRectGetter}
          onHoverProjectChange={(isHovered) => {
            if (hoverReleaseTimerRef.current) {
              window.clearTimeout(hoverReleaseTimerRef.current)
              hoverReleaseTimerRef.current = null
            }

            if (isHovered) {
              setHoveredIndex(index)
              onHoveredProjectChange?.(index)
              return
            }

            hoverReleaseTimerRef.current = window.setTimeout(() => {
              setHoveredIndex((prev) => (prev === index ? -1 : prev))
              onHoveredProjectChange?.(-1)
              hoverReleaseTimerRef.current = null
            }, 60)
          }}
        />
        )
      })}
    </group>
  )
}
