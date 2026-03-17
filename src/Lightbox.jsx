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
    clearProps:
      'position,left,top,width,height,maxWidth,maxHeight,margin,zIndex,x,y,xPercent,willChange,translate,transition,filter,opacity',
  })
}

function fadeVideoVolume(video, nextVolume, duration = 0.28) {
  if (!video) return
  gsap.killTweensOf(video, 'volume')
  gsap.to(video, {
    volume: nextVolume,
    duration,
    ease: 'power1.out',
    overwrite: 'auto',
  })
}

function canShowDesktopNavPreview() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches
}

function isValidRect(rect) {
  return (
    !!rect &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  )
}

export default function Lightbox({
  project,
  onClose,
  visibleProjects = [],
  originRect = null,
  getProjectRect = null,
}) {
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
  const [hoveredNavZone, setHoveredNavZone] = useState(null)
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
  const hasAdjacentVideoProjects = videoProjects.length > 1
  const prevVideoProject = hasAdjacentVideoProjects
    ? videoProjects[(videoIndex - 1 + videoProjects.length) % videoProjects.length]
    : null
  const nextVideoProject = hasAdjacentVideoProjects
    ? videoProjects[(videoIndex + 1) % videoProjects.length]
    : null
  const prevPreviewSrc = prevVideoProject?.poster || prevVideoProject?.src || ''
  const nextPreviewSrc = nextVideoProject?.poster || nextVideoProject?.src || ''
  const showNavPreview = useCallback((zone) => {
    if (!canShowDesktopNavPreview()) return
    setHoveredNavZone(zone)
  }, [])
  const hideNavPreview = useCallback(() => {
    if (!canShowDesktopNavPreview()) return
    setHoveredNavZone(null)
  }, [])

  useEffect(() => {
    setHoveredNavZone(null)
  }, [activeProject?.id])

  const resolveProjectRect = useCallback(
    (projectId) => {
      const liveRect =
        typeof getProjectRect === 'function' && projectId
          ? getProjectRect(projectId)
          : null
      if (isValidRect(liveRect)) return liveRect
      if (isValidRect(originRect)) return originRect
      return null
    },
    [getProjectRect, originRect]
  )

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return
    const activeVideo = isVideoLightbox ? videoRef.current : null
    const targetRect = resolveProjectRect(activeProject?.id)
    if (!targetRect) {
      if (activeVideo && !activeVideo.muted) {
        fadeVideoVolume(activeVideo, 0, 0.2)
      }
      onClose()
      return
    }

    const overlay = overlayRef.current
    const media = isVideoLightbox ? videoRef.current : photoLeadRef.current
    const ui = playerUiRef.current

    if (!overlay || !media) {
      if (activeVideo && !activeVideo.muted) {
        fadeVideoVolume(activeVideo, 0, 0.2)
      }
      onClose()
      return
    }

    isClosingRef.current = true
    setHoveredNavZone(null)
    openAnimRef.current?.kill()
    closeAnimRef.current?.kill()
    gsap.killTweensOf([overlay, media, ui])
    gsap.set(media, {
      x: 0,
      y: 0,
      xPercent: 0,
      translate: '0px 0px',
      transition: 'none',
      filter: 'blur(0px)',
      autoAlpha: 1,
    })

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

    if (activeVideo && !activeVideo.muted) {
      tl.to(activeVideo, {
        volume: 0,
        duration: 0.22,
        ease: 'power1.out',
        overwrite: 'auto',
      }, 0)
    }

    tl.to(media, {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height,
      duration: 0.72,
      ease: 'power2.inOut',
    }, 0)

    tl.to(overlay, {
      backgroundColor: 'rgba(0,0,0,0)',
      duration: 0.26,
      ease: 'power1.inOut',
    }, 0.46)

    closeAnimRef.current = tl
  }, [activeProject?.id, isVideoLightbox, onClose, resolveProjectRect])

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
      setHoveredNavZone(null)
    }
  }, [requestClose])

  useEffect(() => {
    if (!isVideoLightbox || !videoRef.current) return

    const video = videoRef.current
    const direction = transitionDirRef.current

    video.currentTime = 0
    video.muted = false
    video.volume = 0
    setIsMuted(false)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(true)

    gsap.killTweensOf(video)
    gsap.set(video, {
      x: 0,
      xPercent: 0,
      autoAlpha: 1,
      filter: 'blur(0px)',
      translate: '0px 0px',
      transition: 'none',
    })

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

    video.play()
      .then(() => {
        setIsPlaying(true)
        if (!video.muted) {
          fadeVideoVolume(video, 1, 0.34)
        }
      })
      .catch(() => setIsPlaying(false))
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
    gsap.set(overlay, { backgroundColor: 'rgba(0,0,0,1)', pointerEvents: 'auto' })
    gsap.set(media, {
      autoAlpha: 1,
      xPercent: 0,
      filter: 'blur(0px)',
      translate: '0px 0px',
      transition: 'none',
    })

    if (!originRect || isVideoLightbox) {
      const tl = gsap.timeline({
        onComplete: () => {
          clearAnimatedMediaStyles(media)
        },
      })

      openAnimRef.current = tl
      return
    }

    let rafId = 0
    let cancelled = false
    rafId = window.requestAnimationFrame(() => {
      if (cancelled) return
      const finalRect = media.getBoundingClientRect()
      if (!finalRect.width || !finalRect.height) {
        return
      }

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
    if (videoProjects.length <= 1 || isSwitchingRef.current) return
    const video = videoRef.current
    if (!video) return

    isSwitchingRef.current = true
    setHoveredNavZone(null)
    transitionDirRef.current = direction
    const outgoingPercent = direction > 0 ? -26 : 26

    gsap.killTweensOf(video)
    gsap.set(video, {
      translate: '0px 0px',
      transition: 'none',
      filter: 'blur(0px)',
      autoAlpha: 1,
    })
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
      <div
        ref={overlayRef}
        className={`video-lightbox active${
          hoveredNavZone === 'prev' ? ' video-lightbox--show-prev' : ''
        }${hoveredNavZone === 'next' ? ' video-lightbox--show-next' : ''}`}
        onClick={requestClose}
      >
        <video
          key={activeProject.id}
          ref={videoRef}
          src={activeProject.videoUrl}
          poster={activeProject.poster || ''}
          preload="auto"
          className="video-lightbox-media is-active"
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

        {hasAdjacentVideoProjects && prevPreviewSrc ? (
          <div className="player-nav-preview player-nav-preview--prev" aria-hidden="true">
            <img src={prevPreviewSrc} alt="" />
          </div>
        ) : null}

        {hasAdjacentVideoProjects && nextPreviewSrc ? (
          <div className="player-nav-preview player-nav-preview--next" aria-hidden="true">
            <img src={nextPreviewSrc} alt="" />
          </div>
        ) : null}

        <div ref={playerUiRef} className="player-ui" onClick={(event) => event.stopPropagation()}>
          <div className="player-top">
            <div className="player-title">{activeProject.title}</div>
            <div className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</div>
            <button type="button" className="player-close hover-brackets" onClick={requestClose}>CLOSE</button>
          </div>

          <div className="player-bottom">
            <div className="player-left">
              <button type="button" className="player-playpause hover-brackets" onClick={togglePlay}>
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

            <button type="button" className="player-sound hover-brackets" onClick={toggleSound}>
              {isMuted ? 'SOUND OFF' : 'SOUND ON'}
            </button>
          </div>
        </div>

        {hasAdjacentVideoProjects ? (
          <button
            type="button"
            className="player-prev"
            onClick={(event) => {
              event.stopPropagation()
              switchVideo(-1)
            }}
            onMouseEnter={() => showNavPreview('prev')}
            onMouseLeave={hideNavPreview}
            onFocus={() => showNavPreview('prev')}
            onBlur={hideNavPreview}
            aria-label="Previous project"
          >
            <span className="player-nav-label">P</span>
          </button>
        ) : null}
        {hasAdjacentVideoProjects ? (
          <button
            type="button"
            className="player-next"
            onClick={(event) => {
              event.stopPropagation()
              switchVideo(1)
            }}
            onMouseEnter={() => showNavPreview('next')}
            onMouseLeave={hideNavPreview}
            onFocus={() => showNavPreview('next')}
            onBlur={hideNavPreview}
            aria-label="Next project"
          >
            <span className="player-nav-label">N</span>
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="photo-lightbox active" onClick={requestClose}>
      <div className="gallery-header" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-title">{project.title}</div>
        <button type="button" className="gallery-close hover-brackets" onClick={requestClose}>CLOSE</button>
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
