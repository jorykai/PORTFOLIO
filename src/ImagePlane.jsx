import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'

function ignoreRaycast() {
  return null
}

function toScreenRect(mesh, planeWidth, planeHeight, camera) {
  if (!mesh || !camera) return null

  mesh.updateWorldMatrix(true, false)

  const corners = [
    new THREE.Vector3(-planeWidth / 2, -planeHeight / 2, 0),
    new THREE.Vector3(planeWidth / 2, -planeHeight / 2, 0),
    new THREE.Vector3(planeWidth / 2, planeHeight / 2, 0),
    new THREE.Vector3(-planeWidth / 2, planeHeight / 2, 0),
  ]

  const screenPoints = corners.map((point) => {
    point.applyMatrix4(mesh.matrixWorld).project(camera)
    return {
      x: (point.x * 0.5 + 0.5) * window.innerWidth,
      y: (-point.y * 0.5 + 0.5) * window.innerHeight,
    }
  })

  const xs = screenPoints.map((point) => point.x)
  const ys = screenPoints.map((point) => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const right = Math.max(...xs)
  const bottom = Math.max(...ys)

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

const vertexShader = `
  uniform float uDockFocus;
  uniform float uLineX;
  uniform float uScrollSpeed;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFluid;
  void main() {
    vUv = uv;
    vec3 pos = position;

    float dist = uv.x - uLineX;
    float lineMask = exp(-dist * dist * 56.0);
    float speedBoost = clamp(uScrollSpeed, 0.0, 1.0);
    float speedInfluence = smoothstep(0.10, 0.90, speedBoost);
    float fluid = lineMask * clamp(uDockFocus, 0.0, 1.0);
    float wave = sin((uv.y * 16.0) + (uTime * 10.0) + (dist * 28.0));

    // Localized "liquid" bulge around the vertical progress line.
    pos.z += fluid * ((0.012 + 0.052 * speedInfluence) + (0.042 * wave * speedInfluence));

    vFluid = fluid;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uHover;
  uniform float uImageAspect;
  uniform float uPlaneAspect;
  uniform float uLineX;
  uniform float uScrollSpeed;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFluid;

  vec2 coverUv(vec2 uv, float imageAspect, float planeAspect) {
    vec2 centered = uv - 0.5;
    if (planeAspect > imageAspect) {
      centered.y *= planeAspect / imageAspect;
    } else {
      centered.x *= imageAspect / planeAspect;
    }
    return centered + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv, uImageAspect, uPlaneAspect);
    float dist = uv.x - uLineX;
    float lineMask = exp(-dist * dist * 52.0);
    float speedBoost = clamp(uScrollSpeed, 0.0, 1.0);
    float speedInfluence = smoothstep(0.10, 0.90, speedBoost);
    uv.y += sin((uv.x * 24.0) + (uTime * 8.0)) * lineMask * speedInfluence * 0.0085;
    uv.x += dist * lineMask * speedInfluence * 0.03;
    vec4 textureColor = texture2D(uTexture, uv);
    gl_FragColor = vec4(textureColor.rgb + (vFluid * (0.02 + 0.04 * speedInfluence)), textureColor.a * uHover);
  }
`

export default function ImagePlane({
  projectId,
  url,
  videoUrl,
  position,
  offsetX = 0,
  isCentered = false,
  openingState = 'idle',
  onClick,
  onHoverProjectChange,
  title,
  year = '2025',
  type = 'photo',
  runtime = '--:--',
  width = 3,
  height = 2,
  dockFlowRef = null,
  onRegisterProjectRectGetter,
}) {
  const { camera } = useThree()
  const [baseX, baseY, baseZ] = position
  const groupRef = useRef()
  const dockGroupRef = useRef()
  const meshRef = useRef()
  const lineLeftRef = useRef()
  const lineRightRef = useRef()
  const bracketRefs = useRef([])
  const openLabelRef = useRef()
  const runtimeRef = useRef()
  const overlayTimelineRef = useRef(null)
  const positionTweenRef = useRef(null)
  const videoElementRef = useRef(null)
  const videoTextureRef = useRef(null)
  const texture = useTexture(url)
  const [hovered, setHover] = useState(false)
  const isVideo = type === 'video'
  const baseScaleRef = useRef(1)
  const measureRect = useCallback(
    () => toScreenRect(meshRef.current, width, height, camera),
    [camera, width, height]
  )

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uHover: { value: 1.0 },
    uImageAspect: { value: 1.0 },
    uPlaneAspect: { value: width / height },
    uDockFocus: { value: 0 },
    uLineX: { value: 0.5 },
    uScrollSpeed: { value: 0 },
    uTime: { value: 0 },
  }), [texture, width, height])

  useEffect(() => {
    if (texture) {
      texture.needsUpdate = true
      texture.minFilter = THREE.LinearFilter
      texture.generateMipmaps = true
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping

      if (texture.image?.width && texture.image?.height) {
        uniforms.uImageAspect.value = texture.image.width / texture.image.height
      }
    }
  }, [texture, uniforms])

  useEffect(() => {
    if (!isVideo || !videoUrl) return

    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'metadata'

    const videoTexture = new THREE.VideoTexture(video)
    videoTexture.minFilter = THREE.LinearFilter
    videoTexture.magFilter = THREE.LinearFilter
    videoTexture.generateMipmaps = false

    videoElementRef.current = video
    videoTextureRef.current = videoTexture

    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      videoTexture.dispose()
      videoElementRef.current = null
      videoTextureRef.current = null
    }
  }, [isVideo, videoUrl])

  useEffect(() => {
    uniforms.uPlaneAspect.value = width / height
  }, [width, height, uniforms])

  useEffect(() => {
    if (!projectId || typeof onRegisterProjectRectGetter !== 'function') return undefined
    onRegisterProjectRectGetter(projectId, measureRect)
    return () => onRegisterProjectRectGetter(projectId, null)
  }, [measureRect, onRegisterProjectRectGetter, projectId])

  useEffect(() => {
    uniforms.uHover.value = 1.0
  }, [uniforms])

  useEffect(() => {
    if (!isVideo) {
      uniforms.uTexture.value = texture
      return
    }

    const video = videoElementRef.current
    const videoTexture = videoTextureRef.current

    if (!video || !videoTexture) {
      uniforms.uTexture.value = texture
      return
    }

    if (hovered) {
      uniforms.uTexture.value = videoTexture
      const playPromise = video.play()
      if (playPromise?.catch) {
        playPromise.catch(() => {
          uniforms.uTexture.value = texture
        })
      }
      return
    }

    video.pause()
    video.currentTime = 0
    uniforms.uTexture.value = texture
  }, [hovered, isVideo, texture, uniforms])

  useEffect(() => {
    const lines = [lineLeftRef.current, lineRightRef.current].filter(Boolean)
    const brackets = bracketRefs.current.filter(Boolean)
    const labels = [openLabelRef.current, runtimeRef.current].filter(Boolean)

    lines.forEach((line) => {
      line.scale.y = 0
      if (line.material) line.material.opacity = 0
    })
    brackets.forEach((bracket) => {
      bracket.scale.x = 0
      if (bracket.material) bracket.material.opacity = 0
    })
    labels.forEach((label) => {
      if (label.material) {
        label.material.transparent = true
        label.material.opacity = 0
      }
    })

    return () => {
      overlayTimelineRef.current?.kill()
      overlayTimelineRef.current = null
    }
  }, [isVideo])

  useEffect(() => {
    const lines = [lineLeftRef.current, lineRightRef.current].filter(Boolean)
    const brackets = bracketRefs.current.filter(Boolean)
    const labels = [openLabelRef.current, runtimeRef.current].filter(Boolean)

    overlayTimelineRef.current?.kill()

    const tl = gsap.timeline()
    if (hovered) {
      tl.to(
        lines.map((line) => line.scale),
        { y: 1, duration: 0.24, ease: 'power2.out' }
      )
        .to(
          lines.map((line) => line.material),
          { opacity: 1, duration: 0.18, ease: 'power2.out' },
          '<'
        )
        .to(
          brackets.map((bracket) => bracket.scale),
          { x: 1, duration: 0.2, ease: 'power2.out', stagger: 0.03 },
          '-=0.08'
        )
        .to(
          brackets.map((bracket) => bracket.material),
          { opacity: 1, duration: 0.14, ease: 'power2.out', stagger: 0.02 },
          '<'
        )
        .to(
          labels.map((label) => label.material),
          { opacity: 1, duration: 0.16, ease: 'power2.out' },
          '-=0.06'
        )
    } else {
      tl.to(
        labels.map((label) => label.material),
        { opacity: 0, duration: 0.08, ease: 'power1.in' }
      )
        .to(
          brackets.map((bracket) => bracket.scale),
          { x: 0, duration: 0.12, ease: 'power2.in', stagger: 0.015 },
          '<'
        )
        .to(
          brackets.map((bracket) => bracket.material),
          { opacity: 0, duration: 0.08, ease: 'power1.in', stagger: 0.015 },
          '<'
        )
        .to(
          lines.map((line) => line.scale),
          { y: 0, duration: 0.12, ease: 'power2.in' },
          '-=0.05'
        )
        .to(
          lines.map((line) => line.material),
          { opacity: 0, duration: 0.08, ease: 'power1.in' },
          '<'
        )
    }

    overlayTimelineRef.current = tl
  }, [hovered])

  useEffect(() => {
    const group = groupRef.current
    const dockGroup = dockGroupRef.current
    const mesh = meshRef.current
    if (!group || !dockGroup || !mesh) return

    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches
    const positionTweenDuration = isMobileViewport ? 0.38 : 0.56

    positionTweenRef.current?.kill()
    positionTweenRef.current = gsap.to(group.position, {
      x: baseX + offsetX,
      y: baseY,
      z: baseZ,
      duration: positionTweenDuration,
      ease: 'power2.out',
    })

    const groupScale = openingState === 'focus'
      ? 1.22
      : openingState === 'other'
        ? 0.82
        : 1.0

    baseScaleRef.current = groupScale
    dockGroup.scale.set(groupScale, groupScale, 1)
    dockGroup.rotation.set(0, 0, 0)
    dockGroup.position.set(0, 0, 0)
    mesh.scale.set(1, 1, 1)
    uniforms.uHover.value = 1.0

    return () => {
      positionTweenRef.current?.kill()
      positionTweenRef.current = null
    }
  }, [baseX, baseY, baseZ, offsetX, openingState, uniforms])

  useFrame((state) => {
    const dockGroup = dockGroupRef.current
    if (!dockGroup) return

    const dockFocus = dockFlowRef?.focus ?? 0
    const dockLineX = dockFlowRef?.lineX ?? 0.5
    const dockSpeed = dockFlowRef?.speed ?? 0

    uniforms.uDockFocus.value = THREE.MathUtils.lerp(uniforms.uDockFocus.value, dockFocus, 0.2)
    uniforms.uLineX.value = THREE.MathUtils.lerp(
      uniforms.uLineX.value,
      THREE.MathUtils.clamp(dockLineX, -0.5, 1.5),
      0.24
    )
    uniforms.uScrollSpeed.value = THREE.MathUtils.lerp(uniforms.uScrollSpeed.value, dockSpeed, 0.22)
    uniforms.uTime.value = state.clock.elapsedTime

    // Keep card transform fixed; only shader deformation should animate with the line.
    const nextScale = THREE.MathUtils.lerp(dockGroup.scale.x, baseScaleRef.current, 0.2)
    dockGroup.scale.set(nextScale, nextScale, 1)
    dockGroup.position.y = THREE.MathUtils.lerp(dockGroup.position.y, 0, 0.2)
    dockGroup.rotation.y = THREE.MathUtils.lerp(dockGroup.rotation.y, 0, 0.2)
  })

  const framePadX = 0.10
  const framePadY = 0.08
  const lineOffsetX = width / 2 + framePadX
  const topY = height / 2 + framePadY
  const bottomY = -height / 2 - framePadY
  const lineHeight = topY - bottomY
  const bracketLen = 0.09
  const bracketThickness = 0.003
  const lineThickness = 0.003
  const labelGap = 0.028
  const labelFontSize = 0.05

  return (
    <group ref={groupRef} position={position}>
      <group ref={dockGroupRef}>
        <mesh
          ref={meshRef}
          onClick={(event) => {
            const originRect = toScreenRect(meshRef.current, width, height, event.camera)
            onClick?.(originRect)
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer'
            setHover(true)
            onHoverProjectChange?.(true)
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
            setHover(false)
            onHoverProjectChange?.(false)
          }}
        >
          <planeGeometry args={[width, height, 32, 32]} />
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            transparent={true}
          />
        </mesh>

        <group position={[0, 0, 0.02]}>
          <mesh ref={lineLeftRef} position={[-lineOffsetX, 0, 0]} raycast={ignoreRaycast}>
            <planeGeometry args={[lineThickness, lineHeight]} />
            <meshBasicMaterial color="#000000" transparent opacity={0} />
          </mesh>
          <mesh ref={lineRightRef} position={[lineOffsetX, 0, 0]} raycast={ignoreRaycast}>
            <planeGeometry args={[lineThickness, lineHeight]} />
            <meshBasicMaterial color="#000000" transparent opacity={0} />
          </mesh>

          {[
            [-lineOffsetX + bracketLen / 2, topY],
            [-lineOffsetX + bracketLen / 2, bottomY],
            [lineOffsetX - bracketLen / 2, topY],
            [lineOffsetX - bracketLen / 2, bottomY],
          ].map(([x, y], index) => (
            <mesh
              key={`bracket-${index}`}
              ref={(el) => { bracketRefs.current[index] = el }}
              position={[x, y, 0]}
              raycast={ignoreRaycast}
            >
              <planeGeometry args={[bracketLen, bracketThickness]} />
              <meshBasicMaterial color="#000000" transparent opacity={0} />
            </mesh>
          ))}

          <Text
            ref={openLabelRef}
            position={[-lineOffsetX + bracketLen + labelGap, topY, 0]}
            color="#000000"
            fontSize={labelFontSize}
            anchorX="left"
            anchorY="middle"
            material-transparent
            material-opacity={0}
            raycast={ignoreRaycast}
          >
            OPEN
          </Text>

          {isVideo && (
            <Text
              ref={runtimeRef}
              position={[lineOffsetX - bracketLen - labelGap, bottomY, 0]}
              color="#000000"
              fontSize={labelFontSize}
              anchorX="right"
              anchorY="middle"
              material-transparent
              material-opacity={0}
              raycast={ignoreRaycast}
            >
              {runtime || '--:--'}
            </Text>
          )}
        </group>
      </group>
    </group>
  )
}
