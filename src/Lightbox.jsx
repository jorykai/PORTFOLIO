import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function resolveVideoIndex(videoProjects, project) {
  const videoProjectIndex = videoProjects.findIndex((entry) => entry.id === project?.id)
  return videoProjectIndex >= 0 ? videoProjectIndex : 0
}

function clearAnimatedMediaStyles(media) {
  if (!media) return
  gsap.set(media, {
    clearProps: 'position,left,top,width,height,maxWidth,maxHeight,margin,zIndex,x,y,xPercent,willChange',
  })
}

export default function Lightbox({ project, onClose, visibleProjects = [], originRect = null }) {
  const overlayRef = useRef(null)
  const videoRef = useRef(null)
  const photoLeadRef = useRef(null)
  const playerUiRef = useRef(null)
  const progressFillRef = useRef(null)
  const rafProgressRef = useRef(0)
  const openAnimRef = useRef(null)
  const closeAnimRef = useRef(null)
  const transitionDirRef = useRef(0)
  const isSwitchingRef = useRef(false)
  const isClosingRef = useRef(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const isVideoLightbox = project?.type === 'video'
  const photos = project?.gallery || (project?.src ? [project.src] : [])
  const videoProjects = useMemo(
    () => visibleProjects.filter((entry) => entry.type === 'video'),
    [visibleProjects]
  )
  const [videoIndex, setVideoIndex] = useState(() => resolveVideoIndex(videoProjects, project))

  useEffect(() => {
    const nextIndex = resolveVideoIndex(videoProjects, project)
    setVideoIndex((previous) => (previous === nextIndex ? previous : nextIndex))
  }, [project?.id, videoProjects])

  const activeVideoProject = isVideoLightbox
    ? (videoProjects[videoIndex] || project)
    : null

  const activeProject = activeVideoProject || project

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return
    if (!originRect) {
      onClose()
      return
    }

    const overlay = overlayRef.current
    const media = isVideoLightbox ? videoRef.current : photoLeadRef.current
    const ui = playerUiRef.current

    if (!overlay || !media) {
      onClose()
      return
    }

    isClosingRef.current = true
    openAnimRef.current?.kill()
    closeAnimRef.current?.kill()
    gsap.killTweensOf([overlay, media, ui])

    const currentRect = media.getBoundingClientRect()
    gsap.set(overlay, { pointerEvents: 'none' })
    gsap.set(media, {
      position: 'fixed',
      left: currentRect.left,
      top: currentRect.top,
      width: currentRect.width,
      height: currentRect.height,
      maxWidth: 'none',
      maxHeight: 'none',
      margin: 0,
      zIndex: 2147483648,
      x: 0,
      y: 0,
      autoAlpha: 1,
      willChange: 'left, top, width, height, opacity',
    })

    const tl = gsap.timeline({
      onComplete: () => {
        onClose()
      },
    })

    if (ui) {
      tl.to(ui, { autoAlpha: 0, duration: 0.16, ease: 'power1.out' }, 0)
    }

    tl.to(media, {
      left: originRect.left,
      top: originRect.top,
      width: originRect.width,
      height: originRect.height,
      duration: 0.72,
      ease: 'power2.inOut',
    }, 0)

    tl.to(overlay, {
      backgroundColor: 'rgba(255,255,255,0)',
      duration: 0.26,
      ease: 'power1.inOut',
    }, 0.46)

    closeAnimRef.current = tl
  }, [isVideoLightbox, onClose, originRect])

  useEffect(() => {
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    body.classList.add('body--lightbox-open')

    const onKeyDown = (event) => {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      body.style.overflow = previousOverflow
      body.classList.remove('body--lightbox-open')
      window.removeEventListener('keydown', onKeyDown)
      openAnimRef.current?.kill()
      closeAnimRef.current?.kill()
      openAnimRef.current = null
      closeAnimRef.current = null
      isClosingRef.current = false
      isSwitchingRef.current = false
      transitionDirRef.current = 0
    }
  }, [requestClose])

  useEffect(() => {
    if (!isVideoLightbox || !videoRef.current) return

    const video = videoRef.current
    const direction = transitionDirRef.current

    video.currentTime = 0
    video.muted = false
    setIsMuted(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(true)

    gsap.killTweensOf(video)
    gsap.set(video, { x: 0, xPercent: 0, autoAlpha: 1, filter: 'blur(0px)' })

    if (direction !== 0) {
      const incomingPercent = direction > 0 ? 26 : -26
      gsap.set(video, { xPercent: incomingPercent, autoAlpha: 0, filter: 'blur(0.45px)' })

      const tl = gsap.timeline({
        onComplete: () => {
          transitionDirRef.current = 0
          isSwitchingRef.current = false
        },
      })

      tl.to(video, {
        xPercent: 0,
        autoAlpha: 1,
        filter: 'blur(0px)',
        duration: 0.42,
        ease: 'power3.out',
      })
    } else {
      isSwitchingRef.current = false
    }

    video.play().catch(() => setIsPlaying(false))
  }, [activeProject?.id, isVideoLightbox])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    const overlay = overlayRef.current
    const media = isVideoLightbox ? videoRef.current : photoLeadRef.current
    const ui = playerUiRef.current
    if (!overlay || !media) return

    openAnimRef.current?.kill()
    gsap.killTweensOf([overlay, media, ui])
    clearAnimatedMediaStyles(media)

    if (ui) gsap.set(ui, { autoAlpha: 1 })
    gsap.set(overlay, { backgroundColor: 'rgba(255,255,255,1)', pointerEvents: 'auto' })
    gsap.set(media, { autoAlpha: 1, xPercent: 0, filter: 'blur(0px)' })

    if (!originRect) {
      const tl = gsap.timeline()
      openAnimRef.current = tl
      return
    }

    let rafId = 0
    let cancelled = false
    rafId = window.requestAnimationFrame(() => {
      if (cancelled) return
      const finalRect = media.getBoundingClientRect()
      if (!finalRect.width || !finalRect.height) {
        if (ui && isVideoLightbox) {
          gsap.to(ui, { autoAlpha: 1, duration: 0.16, ease: 'power1.out', overwrite: 'auto' })
        }
        return
      }

      if (ui && isVideoLightbox) gsap.set(ui, { autoAlpha: 0 })

      gsap.set(media, {
        position: 'fixed',
        left: originRect.left,
        top: originRect.top,
        width: originRect.width,
        height: originRect.height,
        maxWidth: 'none',
        maxHeight: 'none',
        margin: 0,
        zIndex: 2147483648,
        x: 0,
        y: 0,
        autoAlpha: 1,
        willChange: 'left, top, width, height',
      })

      const tl = gsap.timeline({
        onComplete: () => {
          clearAnimatedMediaStyles(media)
          if (ui && isVideoLightbox) {
            gsap.set(ui, { autoAlpha: 1 })
          }
        },
      })

      tl.to(media, {
        left: finalRect.left,
        top: finalRect.top,
        width: finalRect.width,
        height: finalRect.height,
        duration: 0.98,
        ease: 'power2.inOut',
      }, 0)

      if (ui && isVideoLightbox) {
        tl.to(ui, { autoAlpha: 1, duration: 0.24, ease: 'power1.out' }, 0.74)
      }

      openAnimRef.current = tl
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
      openAnimRef.current?.kill()
      openAnimRef.current = null
      clearAnimatedMediaStyles(media)
      if (ui && isVideoLightbox && !isClosingRef.current) {
        gsap.set(ui, { autoAlpha: 1 })
      }
    }
  }, [isVideoLightbox, originRect, project?.id])

  useEffect(() => {
    if (!isVideoLightbox || !videoRef.current || !progressFillRef.current) return

    const video = videoRef.current
    const progressFill = progressFillRef.current

    const update = () => {
      const dur = video.duration || 0
      const pct = dur > 0 ? Math.max(0, Math.min(1, video.currentTime / dur)) : 0
      progressFill.style.width = `${pct * 100}%`
      rafProgressRef.current = window.requestAnimationFrame(update)
    }

    rafProgressRef.current = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(rafProgressRef.current)
  }, [isVideoLightbox, activeProject?.id])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      return
    }

    video.pause()
    setIsPlaying(false)
  }

  const toggleSound = () => {
    const video = videoRef.current
    if (!video) return
    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
  }

  const jumpTimeline = (event) => {
    const video = videoRef.current
    if (!video || !duration) return

    const rect = event.currentTarget.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    video.currentTime = Math.max(0, Math.min(duration * percent, duration - 0.05))
  }

  const scrubTimeline = (event) => {
    const video = videoRef.current
    if (!video || !duration) return
    const percent = Number(event.target.value) / 100
    video.currentTime = Math.max(0, Math.min(duration * percent, duration - 0.05))
  }

  const switchVideo = (direction) => {
    if (!videoProjects.length || isSwitchingRef.current) return
    const video = videoRef.current
    if (!video) return

    isSwitchingRef.current = true
    transitionDirRef.current = direction
    const outgoingPercent = direction > 0 ? -26 : 26

    gsap.killTweensOf(video)
    const tl = gsap.timeline({
      onComplete: () => {
        const next = (videoIndex + direction + videoProjects.length) % videoProjects.length
        setVideoIndex(next)
      },
    })

    tl.to(video, {
      xPercent: outgoingPercent,
      autoAlpha: 0,
      filter: 'blur(0.45px)',
      duration: 0.28,
      ease: 'power2.in',
    })
  }

  if (!project) return null

  if (isVideoLightbox) {
    return (
      <div ref={overlayRef} className="video-lightbox active" onClick={requestClose}>
        <video
          key={activeProject.id}
          ref={videoRef}
          src={activeProject.videoUrl}
          poster={activeProject.poster || ''}
          preload="auto"
          className="video-lightbox-media"
          playsInline
          loop
          muted={isMuted}
          onClick={(event) => {
            event.stopPropagation()
            togglePlay()
          }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        />

        <div ref={playerUiRef} className="player-ui" onClick={(event) => event.stopPropagation()}>
          <div className="player-top">
            <div className="player-title">{activeProject.title}</div>
            <div className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</div>
            <button type="button" className="player-close" onClick={requestClose}>CLOSE</button>
          </div>

          <div className="player-bottom">
            <div className="player-left">
              <button type="button" className="player-playpause" onClick={togglePlay}>
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
            </div>

            <div className="player-timeline" onClick={jumpTimeline}>
              <div ref={progressFillRef} className="player-progress-fill" />
              <input
                className="player-progress-input"
                type="range"
                min="0"
                max="100"
                step="0.1"
                defaultValue="0"
                onInput={scrubTimeline}
                aria-label="Video progress"
              />
            </div>

            <button type="button" className="player-sound" onClick={toggleSound}>
              {isMuted ? 'SOUND OFF' : 'SOUND ON'}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="player-prev"
          onClick={(event) => {
            event.stopPropagation()
            switchVideo(-1)
          }}
        >
          P
        </button>
        <button
          type="button"
          className="player-next"
          onClick={(event) => {
            event.stopPropagation()
            switchVideo(1)
          }}
        >
          N
        </button>
      </div>
    )
  }

  return (
    <div className="photo-lightbox active" onClick={requestClose}>
      <div className="gallery-header" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-title">{project.title}</div>
        <button type="button" className="gallery-close" onClick={requestClose}>CLOSE</button>
      </div>

      <div className="photo-gallery" onClick={(event) => event.stopPropagation()}>
        {photos.map((src, index) => (
          <img
            key={`${project.id}-image-${index}`}
            ref={index === 0 ? photoLeadRef : null}
            src={src}
            alt=""
          />
        ))}
      </div>
    </div>
  )
}
