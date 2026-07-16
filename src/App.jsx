import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { projects } from './projects'

const HomeCanvas = lazy(() => import('./HomeCanvas'))
const Lightbox = lazy(() => import('./Lightbox'))

const RULER_LINE_NUMBER_GAP = 20
const RULER_TICK_SPACING = 12
const RULER_TICK_WIDTH = 1
const RULER_TICK_BASE_HEIGHT = 12
const RULER_TICK_BULGE_AMP = 16
const RULER_TICK_BULGE_SIGMA = 36
const RULER_PLAYHEAD_LERP = 0.12
const RULER_CANVAS_HEIGHT = 30
const RULER_TICK_COLOR = 'rgba(0, 0, 0, 0.14)'
const SITE_URL = 'https://jorywestra.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/jorywestra.jpg`

function normalizePath(pathname) {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function upsertMetaTag(attribute, key, content) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function upsertLinkTag(rel, href) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`script[data-seo="${id}"]`)
  if (!tag) {
    tag = document.createElement('script')
    tag.type = 'application/ld+json'
    tag.setAttribute('data-seo', id)
    document.head.appendChild(tag)
  }
  tag.textContent = JSON.stringify(data)
}

// --- 1. THE HEADER (Internal) ---
function Header({
  setFilter,
  activeFilter,
  disabled = false,
  isAboutPage = false,
  onNavigate,
  isNavigating = false,
}) {
  const formatCount = (count) => String(count).padStart(2, '0')
  const allCount = projects.length
  const videoCount = projects.filter((project) => project.type === 'video').length
  const photoCount = projects.filter((project) => project.type === 'photo').length

  return (
    <div className={isAboutPage ? 'custom-header is-about' : 'custom-header'}>
      <div className="site-name">
        <a
          href="/"
          className="site-title-link"
          onClick={(event) => {
            event.preventDefault()
            onNavigate?.('/', { animate: isAboutPage })
          }}
        >
          <span className="site-title-bracket">[</span>
          <span className="site-title-text"> JORY WESTRA </span>
          <span className="site-title-bracket">]</span>
        </a>
      </div>

      <div className="menu">
        <ul>
          <li>
            {isAboutPage ? (
              <button
                type="button"
                className="menu-link is-active"
                onClick={() => onNavigate?.('/', { animate: true })}
              >
                <span className="menu-link-label">ALL PROJECTS</span>
                <span className="menu-link-count" aria-hidden="true">
                  <span className="menu-count-bracket">[</span>
                  <span className="menu-count-value">{formatCount(allCount)}</span>
                  <span className="menu-count-bracket">]</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={activeFilter === 'all' ? 'menu-link is-active' : 'menu-link'}
                disabled={disabled || isNavigating}
                onClick={() => setFilter('all')}
              >
                <span className="menu-link-label">ALL PROJECTS</span>
                <span className="menu-link-count" aria-hidden="true">
                  <span className="menu-count-bracket">[</span>
                  <span className="menu-count-value">{formatCount(allCount)}</span>
                  <span className="menu-count-bracket">]</span>
                </span>
              </button>
            )}
          </li>
          {!isAboutPage && (
            <li>
              <button
                type="button"
                className={activeFilter === 'video' ? 'menu-link is-active' : 'menu-link'}
                disabled={disabled || isNavigating}
                onClick={() => setFilter('video')}
              >
                <span className="menu-link-label">VIDEOGRAPHY</span>
                <span className="menu-link-count" aria-hidden="true">
                  <span className="menu-count-bracket">[</span>
                  <span className="menu-count-value">{formatCount(videoCount)}</span>
                  <span className="menu-count-bracket">]</span>
                </span>
              </button>
            </li>
          )}
          {!isAboutPage && (
            <li>
              <button
                type="button"
                className={activeFilter === 'photo' ? 'menu-link is-active' : 'menu-link'}
                disabled={disabled || isNavigating}
                onClick={() => setFilter('photo')}
              >
                <span className="menu-link-label">PHOTOGRAPHY</span>
                <span className="menu-link-count" aria-hidden="true">
                  <span className="menu-count-bracket">[</span>
                  <span className="menu-count-value">{formatCount(photoCount)}</span>
                  <span className="menu-count-bracket">]</span>
                </span>
              </button>
            </li>
          )}
        </ul>
      </div>

      <div className="right-links">
        {!isAboutPage && (
          <a
            className="hover-brackets"
            href="/about"
            onClick={(event) => {
              event.preventDefault()
              onNavigate?.('/about', { animate: true })
            }}
          >
            ABOUT
          </a>
        )}
        <a className="hover-brackets" href="mailto:jory@jorywestra.com?subject=Inquiry%20to%20work">
          CONTACT
        </a>
      </div>
    </div>
  )
}

function getOsloUtcOffsetLabel(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    timeZoneName: 'shortOffset',
  }).formatToParts(now)

  const rawOffset = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+1'
  return rawOffset.replace('GMT', 'UTC')
}

function AboutPage({ onNavigate }) {
  const [now, setNow] = useState(() => new Date())
  const imageRef = useRef(null)
  const copyRef = useRef(null)
  const aboutLabelRef = useRef(null)
  const contactLabelRef = useRef(null)
  const titleRef = useRef(null)
  const timeRef = useRef(null)
  const enterTimelineRef = useRef(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const osloOffset = useMemo(() => getOsloUtcOffsetLabel(now), [now])
  const osloTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(now),
    [now]
  )

  useEffect(() => {
    if (!window.matchMedia('(min-width: 769px)').matches) return undefined

    const image = imageRef.current
    const copy = copyRef.current
    const aboutLabel = aboutLabelRef.current
    const contactLabel = contactLabelRef.current
    const title = titleRef.current
    const time = timeRef.current

    if (!image || !copy || !aboutLabel || !contactLabel || !title || !time) return undefined

    enterTimelineRef.current?.kill()
    gsap.killTweensOf([image, copy, aboutLabel, contactLabel, title, time])

    gsap.set(image, { xPercent: -12, autoAlpha: 0, willChange: 'transform,opacity' })
    gsap.set(copy, { yPercent: -18, autoAlpha: 0, willChange: 'transform,opacity' })
    gsap.set([aboutLabel, contactLabel, title, time], {
      yPercent: 112,
      willChange: 'transform',
    })

    const tl = gsap.timeline({
      defaults: { ease: 'expo.out' },
      onComplete: () => {
        gsap.set([image, copy, aboutLabel, contactLabel, title, time], { clearProps: 'willChange' })
      },
    })

    tl.to(image, { xPercent: 0, autoAlpha: 1, duration: 0.88 }, 0.02)
    tl.to(aboutLabel, { yPercent: 0, duration: 0.58 }, 0.24)
    tl.to(copy, { yPercent: 0, autoAlpha: 1, duration: 0.56, ease: 'power2.out' }, 0.32)
    tl.to(contactLabel, { yPercent: 0, duration: 0.54 }, 0.50)
    tl.to(title, { yPercent: 0, duration: 0.66 }, 0.56)
    tl.to(time, { yPercent: 0, duration: 0.52 }, 0.64)

    enterTimelineRef.current = tl

    return () => {
      enterTimelineRef.current?.kill()
      enterTimelineRef.current = null
    }
  }, [])

  return (
    <main className="about-page">
      <a
        href="/"
        className="about-mobile-scroll-title"
        onClick={(event) => {
          event.preventDefault()
          onNavigate?.('/', { animate: false })
        }}
      >
        <span className="site-title-bracket">[</span>
        <span className="site-title-text"> JORY WESTRA </span>
        <span className="site-title-bracket">]</span>
      </a>

      <section className="about-photo-column" aria-hidden="true">
        <img
          ref={imageRef}
          src="/images/jorywestra2.jpg"
          alt=""
          className="about-photo"
          loading="eager"
          decoding="async"
        />
      </section>

      <section className="about-content-column">
        <div className="about-sections">
          <div className="about-row">
            <div className="about-label about-reveal-mask">
              <span ref={aboutLabelRef} className="about-reveal-line">[ ABOUT ]</span>
            </div>
            <div className="about-copy-mask">
              <div ref={copyRef} className="about-copy">
                <p>
                  I&apos;M A FREELANCE VIDEOGRAPHER BASED IN OSLO AND AMSTERDAM, CREATING VISUAL CONTENT FOR
                  BRANDS, BUSINESSES, AND PEOPLE WHO WANT CLEAR, REFINED, AND ENGAGING STORYTELLING.
                </p>
                <p>
                  MY BACKGROUND SPANS OPERATIONS, MARKETING, AND CONTENT, WHICH MEANS I BRING MORE THAN
                  JUST FILMING TO A PROJECT. I UNDERSTAND HOW TO SHAPE VISUALS THAT SUPPORT A BRAND,
                  COMMUNICATE CLEARLY, AND FEEL CONSISTENT ACROSS PLATFORMS.
                </p>
                <p>
                  I&apos;VE WORKED ACROSS PRODUCT-FOCUSED, CREATIVE, AND BRAND-LED ENVIRONMENTS FOR NAMES
                  LIKE MASE HOME, REBOTTLED, DNV, AND JIMMY NELSON. FROM PLANNING AND CAPTURING CONTENT TO
                  SUPPORTING BRAND COMMUNICATION AND VISUAL DIRECTION, I ENJOY COMBINING STRUCTURE WITH
                  CREATIVITY TO MAKE CONTENT FEEL INTENTIONAL AND POLISHED.
                </p>
                <p>
                  ORIGINALLY FROM THE NETHERLANDS AND NOW BASED IN OSLO AND AMSTERDAM, I&apos;M AVAILABLE FOR
                  FREELANCE VIDEOGRAPHY PROJECTS IN OSLO, AMSTERDAM AND SURROUNDING AREAS.
                </p>
              </div>
            </div>
          </div>

          <div className="about-row">
            <div className="about-label about-reveal-mask">
              <span ref={contactLabelRef} className="about-reveal-line">[ CONTACT ]</span>
            </div>
            <div className="about-contact-links">
              <a className="hover-brackets" href="https://instagram.com/jorywestra" target="_blank" rel="noreferrer">
                INSTAGRAM
              </a>
              <a className="hover-brackets" href="https://www.tiktok.com/@jorywestra" target="_blank" rel="noreferrer">
                TIKTOK
              </a>
              <a className="hover-brackets" href="mailto:jory@jorywestra.com?subject=Inquiry%20to%20work">
                EMAIL
              </a>
            </div>
          </div>
        </div>

        <footer className="about-footer">
          <div className="about-title-mask">
            <div ref={titleRef} className="about-big-title">JORY WESTRA 2026®</div>
          </div>
          <div className="about-time-mask">
            <div ref={timeRef} className="about-time-row">
              <span className="about-time-location">OSLO, NORWAY ({osloOffset})</span>
              <span className="about-time-clock">{osloTime}</span>
            </div>
          </div>
        </footer>
      </section>
    </main>
  )
}

// --- 2. MAIN APP ---
export default function App() {
  const [routePath, setRoutePath] = useState(() => normalizePath(window.location.pathname))
  const isAboutPage = routePath === '/about'
  const [filter, setFilter] = useState('all')
  const [selectedProject, setSelectedProject] = useState(null)
  const [lightboxOriginRect, setLightboxOriginRect] = useState(null)
  const [openingProjectId, setOpeningProjectId] = useState(null)
  const [centeredIndex, setCenteredIndex] = useState(0)
  const [lineHitIndex, setLineHitIndex] = useState(0)
  const [hoveredProjectIndex, setHoveredProjectIndex] = useState(-1)
  const [runtimeById, setRuntimeById] = useState({})
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.matchMedia('(max-width: 768px)').matches
  )
  const hoverWrapRef = useRef(null)
  const hoverLineRef = useRef(null)
  const hoverCurrentTitleRef = useRef('')
  const hoverTimelineRef = useRef(null)
  const hoverYearWrapRef = useRef(null)
  const hoverYearLineRef = useRef(null)
  const hoverCurrentYearRef = useRef('')
  const hoverYearTimelineRef = useRef(null)
  const lineFocusIndexRef = useRef(-1)
  const openDelayTimerRef = useRef(null)
  const canvasShellRef = useRef(null)
  const filterTransitionRef = useRef(null)
  const filterWipeRef = useRef({ progress: 0, direction: -1 })
  const scrollGuideLineRef = useRef(null)
  const openingIntroRef = useRef(null)
  const openingIntroLineRef = useRef(null)
  const headerNavTransitionRef = useRef(null)
  const mainEnterTransitionRef = useRef(null)
  const prevIsAboutPageRef = useRef(isAboutPage)
  const hasPlayedMainEnterRef = useRef(false)
  const desktopRulerTrackRef = useRef(null)
  const desktopRulerCanvasRef = useRef(null)
  const desktopRulerMarkerRefs = useRef([])
  const desktopRulerMarkerWindowsRef = useRef([])
  const desktopRulerTargetXRef = useRef(null)
  const desktopRulerPlayheadXRef = useRef(null)
  const desktopRulerTrackWidthRef = useRef(0)
  const desktopRulerTrackMetricsRef = useRef({ x: null, width: null })
  const desktopRulerPositionsRef = useRef([])
  const projectRectGettersRef = useRef(new Map())
  const [isFilterTransitioning, setIsFilterTransitioning] = useState(false)
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)
  const [isCarouselReady, setIsCarouselReady] = useState(false)
  const [hasOpeningIntroEntered, setHasOpeningIntroEntered] = useState(false)
  const [showOpeningIntro, setShowOpeningIntro] = useState(
    () => normalizePath(window.location.pathname) === '/'
  )

  const visibleProjects = useMemo(
    () => projects.filter((project) => filter === 'all' || project.type === filter),
    [filter]
  )
  const activeProject = visibleProjects[centeredIndex] || null
  const scrollPages = useMemo(
    () => {
      const perItem = isMobileViewport ? 0.62 : 0.35
      const minPages = isMobileViewport ? 2.25 : 1.35
      return Math.max(minPages, visibleProjects.length * perItem)
    },
    [visibleProjects.length, isMobileViewport]
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobileViewport(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setRoutePath(normalizePath(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleRegisterProjectRectGetter = useCallback((projectId, getter) => {
    if (!projectId) return
    if (typeof getter === 'function') {
      projectRectGettersRef.current.set(projectId, getter)
      return
    }
    projectRectGettersRef.current.delete(projectId)
  }, [])

  const getProjectRect = useCallback((projectId) => {
    if (!projectId) return null
    const getter = projectRectGettersRef.current.get(projectId)
    return typeof getter === 'function' ? getter() : null
  }, [])

  useEffect(() => {
    const canonicalPath = routePath === '/' ? '' : routePath
    const canonicalUrl = `${SITE_URL}${canonicalPath}`
    const isHome = routePath === '/'
    const title = isHome
      ? 'Videographer In Oslo | Jory Westra'
      : 'About | Jory Westra'
    const description = isHome
      ? 'Freelance videographer in Oslo creating refined brand films, social content, and commercial video for brands, businesses, and people in Oslo and surrounding areas.'
      : 'Jory Westra is a freelance videographer based in Oslo, creating refined visual content for brands, businesses, and people in Oslo and surrounding areas.'

    document.title = title
    upsertMetaTag('name', 'description', description)
    upsertMetaTag('name', 'robots', 'index, follow')
    upsertMetaTag('property', 'og:type', 'website')
    upsertMetaTag('property', 'og:site_name', 'Jory Westra')
    upsertMetaTag('property', 'og:title', title)
    upsertMetaTag('property', 'og:description', description)
    upsertMetaTag('property', 'og:url', canonicalUrl)
    upsertMetaTag('property', 'og:image', DEFAULT_OG_IMAGE)
    upsertMetaTag('name', 'twitter:card', 'summary_large_image')
    upsertMetaTag('name', 'twitter:title', title)
    upsertMetaTag('name', 'twitter:description', description)
    upsertMetaTag('name', 'twitter:image', DEFAULT_OG_IMAGE)
    upsertLinkTag('canonical', canonicalUrl)

    if (isHome) {
      upsertJsonLd('professional-service', {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        name: 'Jory Westra',
        url: SITE_URL,
        image: DEFAULT_OG_IMAGE,
        description,
        email: 'jory@jorywestra.com',
        areaServed: [
          { '@type': 'City', name: 'Oslo' },
          { '@type': 'Country', name: 'Norway' },
        ],
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Oslo',
          addressCountry: 'NO',
        },
        sameAs: [
          'https://instagram.com/jorywestra',
          'https://www.tiktok.com/@jorywestra',
        ],
        serviceType: [
          'Videography',
          'Commercial Videography',
          'Brand Video Production',
          'Social Media Video Content',
        ],
      })
      return
    }

    const existingJsonLd = document.head.querySelector('script[data-seo="professional-service"]')
    if (existingJsonLd) existingJsonLd.remove()
  }, [routePath])

  const handleNavigate = useCallback((targetPath, options = {}) => {
    const normalized = normalizePath(targetPath)
    if (normalized === routePath || isPageTransitioning) return

    const { animate = false } = options
    const isDesktop = window.matchMedia('(min-width: 769px)').matches
    const shouldAnimateMainToAbout = animate && isDesktop && !isAboutPage && normalized === '/about'
    const shouldAnimateAboutToMain = animate && isDesktop && isAboutPage && normalized === '/'

    const commitRoute = () => {
      if (normalized === '/') {
        setFilter('all')
      }
      window.history.pushState({}, '', normalized)
      setRoutePath(normalized)
    }

    if (!shouldAnimateMainToAbout && !shouldAnimateAboutToMain) {
      commitRoute()
      return
    }

    setIsPageTransitioning(true)

    headerNavTransitionRef.current?.kill()
    if (shouldAnimateMainToAbout) {
      const menuTargets = Array.from(
        document.querySelectorAll('.custom-header:not(.is-about) .menu .menu-link')
      )

      if (!menuTargets.length) {
        commitRoute()
        setIsPageTransitioning(false)
        return
      }

      gsap.killTweensOf(menuTargets)

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(menuTargets, {
            opacity: 1,
            visibility: 'visible',
            clearProps: 'transform,opacity,visibility,willChange',
          })
          commitRoute()
          setIsPageTransitioning(false)
          headerNavTransitionRef.current = null
        },
      })

      tl.set(menuTargets, { willChange: 'transform,opacity' })
      tl.to(menuTargets, {
        yPercent: -116,
        opacity: 0,
        duration: 0.34,
        ease: 'power2.in',
        stagger: 0.038,
      }, 0)

      headerNavTransitionRef.current = tl
      return
    }

    const image = document.querySelector('.about-photo')
    const copy = document.querySelector('.about-copy')
    const aboutLabel = document.querySelector('.about-row:first-child .about-reveal-line')
    const contactLabel = document.querySelector('.about-row:nth-child(2) .about-reveal-line')
    const title = document.querySelector('.about-big-title')
    const time = document.querySelector('.about-time-row')
    const links = document.querySelector('.about-contact-links')

    const targets = [image, copy, aboutLabel, contactLabel, title, time, links].filter(Boolean)

    if (!targets.length) {
      commitRoute()
      setIsPageTransitioning(false)
      return
    }

    gsap.killTweensOf(targets)

    const tl = gsap.timeline({
      defaults: { ease: 'power2.in' },
      onComplete: () => {
        gsap.set(targets, { clearProps: 'transform,opacity,willChange' })
        commitRoute()
        setIsPageTransitioning(false)
        headerNavTransitionRef.current = null
      },
    })

    tl.set(targets, { willChange: 'transform,opacity' }, 0)
    tl.to([aboutLabel, contactLabel, title, time].filter(Boolean), {
      yPercent: 112,
      duration: 0.34,
      stagger: 0.028,
    }, 0)
    tl.to(copy, {
      yPercent: -18,
      autoAlpha: 0,
      duration: 0.32,
      ease: 'power2.inOut',
    }, 0.04)
    tl.to(links, {
      yPercent: -14,
      autoAlpha: 0,
      duration: 0.28,
    }, 0.06)
    tl.to(image, {
      xPercent: -12,
      autoAlpha: 0,
      duration: 0.42,
      ease: 'expo.inOut',
    }, 0)

    headerNavTransitionRef.current = tl
  }, [isAboutPage, isPageTransitioning, routePath])

  useEffect(() => {
    const menuTargets = Array.from(document.querySelectorAll('.custom-header .menu .menu-link'))
    if (!menuTargets.length) return
    gsap.set(menuTargets, {
      opacity: 1,
      visibility: 'visible',
      clearProps: 'transform,opacity,visibility,willChange',
    })
  }, [routePath])

  const handleRuntimeChange = useCallback((projectId, runtime) => {
    setRuntimeById((previous) => (
      previous[projectId] === runtime ? previous : { ...previous, [projectId]: runtime }
    ))
  }, [])

  const handleCarouselReady = useCallback(() => {
    setIsCarouselReady(true)
  }, [])

  const handleLightboxClose = useCallback(() => {
    setSelectedProject(null)
    setLightboxOriginRect(null)
    setOpeningProjectId(null)
  }, [])

  useEffect(() => {
    const intro = openingIntroRef.current
    const line = openingIntroLineRef.current
    if (!showOpeningIntro || isAboutPage || !intro || !line) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frameId = window.requestAnimationFrame(() => setHasOpeningIntroEntered(true))
      return () => window.cancelAnimationFrame(frameId)
    }

    gsap.set(intro, { autoAlpha: 1, xPercent: 0 })
    gsap.set(line, { yPercent: 115 })

    const timeline = gsap.to(line, {
      yPercent: 0,
      duration: 0.42,
      ease: 'expo.out',
      onComplete: () => setHasOpeningIntroEntered(true),
    })

    return () => timeline.kill()
  }, [isAboutPage, showOpeningIntro])

  useEffect(() => {
    const intro = openingIntroRef.current
    const line = openingIntroLineRef.current
    if (!showOpeningIntro || !hasOpeningIntroEntered || !isCarouselReady || !intro || !line) {
      return undefined
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frameId = window.requestAnimationFrame(() => setShowOpeningIntro(false))
      return () => window.cancelAnimationFrame(frameId)
    }

    const timeline = gsap.timeline({
      onComplete: () => setShowOpeningIntro(false),
    })

    timeline
      .to(intro, { xPercent: -100, duration: 0.48, ease: 'power3.inOut' })
      .to(line, { yPercent: -115, duration: 0.26, ease: 'power2.in' }, 0.04)

    return () => timeline.kill()
  }, [hasOpeningIntroEntered, isCarouselReady, showOpeningIntro])

  useEffect(() => {
    const shell = canvasShellRef.current
    const wasAboutPage = prevIsAboutPageRef.current
    const returningFromAbout = wasAboutPage && !isAboutPage
    prevIsAboutPageRef.current = isAboutPage

    if (isAboutPage || !shell) return
    if (isFilterTransitioning || isPageTransitioning) return

    if (!returningFromAbout) {
      hasPlayedMainEnterRef.current = true
      return
    }

    mainEnterTransitionRef.current?.kill()
    gsap.killTweensOf(shell)
    gsap.set(shell, { xPercent: 100, willChange: 'transform' })

    mainEnterTransitionRef.current = gsap.to(shell, {
      xPercent: 0,
      duration: 0.62,
      ease: 'power3.out',
      onComplete: () => {
        gsap.set(shell, { clearProps: 'transform,willChange' })
        mainEnterTransitionRef.current = null
      },
    })

    if (returningFromAbout) {
      const menuTargets = Array.from(
        document.querySelectorAll('.custom-header:not(.is-about) .menu .menu-link')
      )
      if (menuTargets.length) {
        gsap.killTweensOf(menuTargets)
        headerNavTransitionRef.current?.kill()

        const headerTl = gsap.timeline({
          onComplete: () => {
            gsap.set(menuTargets, {
              opacity: 1,
              visibility: 'visible',
              clearProps: 'transform,opacity,visibility,willChange',
            })
            headerNavTransitionRef.current = null
          },
        })

        headerTl.set(menuTargets, {
          yPercent: -116,
          opacity: 0,
          visibility: 'visible',
          willChange: 'transform,opacity',
        })
        headerTl.to(menuTargets, {
          yPercent: 0,
          opacity: 1,
          duration: 0.42,
          ease: 'power2.out',
          stagger: 0.036,
        }, 0.05)

        headerNavTransitionRef.current = headerTl
      }
    }

    hasPlayedMainEnterRef.current = true
  }, [isAboutPage, isFilterTransitioning, isPageTransitioning])

  const handleHoverTitleChange = useCallback((nextTitleRaw = '') => {
    if (!hoverWrapRef.current || !hoverLineRef.current) return
    if (window.matchMedia('(max-width: 768px)').matches) return

    const nextTitle = nextTitleRaw.trim()
    const wrap = hoverWrapRef.current
    const line = hoverLineRef.current
    const currentTitle = hoverCurrentTitleRef.current

    hoverTimelineRef.current?.kill()
    gsap.killTweensOf([wrap, line])

    if (nextTitle && nextTitle === currentTitle) {
      gsap.set(wrap, { autoAlpha: 1 })
      gsap.set(line, { yPercent: 0 })
      return
    }

    if (!nextTitle) {
      if (!currentTitle) return

      const tl = gsap.timeline({
        onComplete: () => {
          hoverCurrentTitleRef.current = ''
          line.textContent = ''
          gsap.set(wrap, { autoAlpha: 0 })
          gsap.set(line, { yPercent: 110 })
          hoverTimelineRef.current = null
        },
      })
      tl.to(line, { yPercent: -110, duration: 0.34, ease: 'power2.in' })
      hoverTimelineRef.current = tl
      return
    }

    const setTitle = () => {
      line.textContent = nextTitle
      hoverCurrentTitleRef.current = nextTitle
    }

    if (!currentTitle) {
      setTitle()
      gsap.set(wrap, { autoAlpha: 1 })
      const tl = gsap.timeline({ onComplete: () => { hoverTimelineRef.current = null } })
      tl.fromTo(line, { yPercent: 110 }, { yPercent: 0, duration: 0.52, ease: 'expo.out' })
      hoverTimelineRef.current = tl
      return
    }

    const tl = gsap.timeline({ onComplete: () => { hoverTimelineRef.current = null } })
    tl.to(line, { yPercent: -110, duration: 0.28, ease: 'power2.in' })
      .add(() => {
        setTitle()
        gsap.set(wrap, { autoAlpha: 1 })
        gsap.set(line, { yPercent: 110 })
      })
      .to(line, { yPercent: 0, duration: 0.48, ease: 'expo.out' })
    hoverTimelineRef.current = tl
  }, [])

  const handleHoverYearChange = useCallback((nextYearRaw = '') => {
    if (!hoverYearWrapRef.current || !hoverYearLineRef.current) return
    if (window.matchMedia('(max-width: 768px)').matches) return

    const nextYear = nextYearRaw.trim()
    const wrap = hoverYearWrapRef.current
    const line = hoverYearLineRef.current
    const currentYear = hoverCurrentYearRef.current

    hoverYearTimelineRef.current?.kill()
    gsap.killTweensOf([wrap, line])

    if (nextYear && nextYear === currentYear) {
      gsap.set(wrap, { autoAlpha: 1 })
      gsap.set(line, { yPercent: 0 })
      return
    }

    if (!nextYear) {
      if (!currentYear) return

      const tl = gsap.timeline({
        onComplete: () => {
          hoverCurrentYearRef.current = ''
          line.textContent = ''
          gsap.set(wrap, { autoAlpha: 0 })
          gsap.set(line, { yPercent: 110 })
          hoverYearTimelineRef.current = null
        },
      })
      tl.to(line, { yPercent: -110, duration: 0.34, ease: 'power2.in' })
      hoverYearTimelineRef.current = tl
      return
    }

    const setYear = () => {
      line.textContent = nextYear
      hoverCurrentYearRef.current = nextYear
    }

    if (!currentYear) {
      setYear()
      gsap.set(wrap, { autoAlpha: 1 })
      const tl = gsap.timeline({ onComplete: () => { hoverYearTimelineRef.current = null } })
      tl.fromTo(line, { yPercent: 110 }, { yPercent: 0, duration: 0.52, ease: 'expo.out' })
      hoverYearTimelineRef.current = tl
      return
    }

    const tl = gsap.timeline({ onComplete: () => { hoverYearTimelineRef.current = null } })
    tl.to(line, { yPercent: -110, duration: 0.28, ease: 'power2.in' })
      .add(() => {
        setYear()
        gsap.set(wrap, { autoAlpha: 1 })
        gsap.set(line, { yPercent: 110 })
      })
      .to(line, { yPercent: 0, duration: 0.48, ease: 'expo.out' })
    hoverYearTimelineRef.current = tl
  }, [])

  useEffect(() => {
    if (!hoverWrapRef.current || !hoverLineRef.current || !hoverYearWrapRef.current || !hoverYearLineRef.current) return

    gsap.set(hoverWrapRef.current, { autoAlpha: 0 })
    gsap.set(hoverLineRef.current, { yPercent: 110 })
    gsap.set(hoverYearWrapRef.current, { autoAlpha: 0 })
    gsap.set(hoverYearLineRef.current, { yPercent: 110 })

    return () => {
      if (openDelayTimerRef.current) {
        window.clearTimeout(openDelayTimerRef.current)
        openDelayTimerRef.current = null
      }
      hoverTimelineRef.current?.kill()
      hoverTimelineRef.current = null
      hoverYearTimelineRef.current?.kill()
      hoverYearTimelineRef.current = null
    }
  }, [])

  const clearDesktopRulerCanvas = useCallback(() => {
    const canvas = desktopRulerCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const drawDesktopRulerCanvas = useCallback(() => {
    const canvas = desktopRulerCanvasRef.current
    const trackWidth = desktopRulerTrackWidthRef.current
    if (!canvas || !Number.isFinite(trackWidth) || trackWidth <= 0) {
      clearDesktopRulerCanvas()
      return
    }

    const cssWidth = trackWidth
    const cssHeight = RULER_CANVAS_HEIGHT
    const dpr = window.devicePixelRatio || 1
    const pxWidth = Math.max(1, Math.round(cssWidth * dpr))
    const pxHeight = Math.max(1, Math.round(cssHeight * dpr))

    if (canvas.width !== pxWidth || canvas.height !== pxHeight) {
      canvas.width = pxWidth
      canvas.height = pxHeight
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const targetX = desktopRulerTargetXRef.current
    if (!Number.isFinite(targetX)) return

    let playheadX = desktopRulerPlayheadXRef.current
    if (!Number.isFinite(playheadX)) playheadX = targetX
    playheadX += (targetX - playheadX) * RULER_PLAYHEAD_LERP
    desktopRulerPlayheadXRef.current = playheadX

    const exclusionWindows = desktopRulerMarkerWindowsRef.current
    ctx.fillStyle = RULER_TICK_COLOR
    for (let x = 0; x <= cssWidth + 0.01; x += RULER_TICK_SPACING) {
      let isBlocked = false
      for (let i = 0; i < exclusionWindows.length; i += 1) {
        const [start, end] = exclusionWindows[i]
        if (x >= start && x <= end) {
          isBlocked = true
          break
        }
      }
      if (isBlocked) continue

      const d = Math.abs(x - playheadX)
      const bump = Math.exp(-(d * d) / (2 * RULER_TICK_BULGE_SIGMA * RULER_TICK_BULGE_SIGMA))
      const height = RULER_TICK_BASE_HEIGHT + RULER_TICK_BULGE_AMP * bump
      ctx.fillRect(Math.round(x), cssHeight - height, RULER_TICK_WIDTH, height)
    }
  }, [clearDesktopRulerCanvas])

  useEffect(() => {
    setCenteredIndex(0)
    setLineHitIndex(0)
    setHoveredProjectIndex(-1)
    lineFocusIndexRef.current = -1
    handleHoverTitleChange('')
    handleHoverYearChange('')
    desktopRulerTrackMetricsRef.current = { x: null, width: null }
    desktopRulerPositionsRef.current = []
    desktopRulerMarkerWindowsRef.current = []
    desktopRulerTargetXRef.current = null
    desktopRulerPlayheadXRef.current = null
    desktopRulerTrackWidthRef.current = 0
    clearDesktopRulerCanvas()
    if (scrollGuideLineRef.current) {
      scrollGuideLineRef.current.style.left = '0%'
    }
  }, [clearDesktopRulerCanvas, filter, handleHoverTitleChange, handleHoverYearChange])

  useEffect(() => {
    desktopRulerMarkerRefs.current = desktopRulerMarkerRefs.current.slice(0, visibleProjects.length)
    setHoveredProjectIndex(-1)
    lineFocusIndexRef.current = -1
    desktopRulerTrackMetricsRef.current = { x: null, width: null }
    desktopRulerPositionsRef.current = []
    desktopRulerMarkerWindowsRef.current = []
    desktopRulerTargetXRef.current = null
    desktopRulerPlayheadXRef.current = null
    desktopRulerTrackWidthRef.current = 0
    clearDesktopRulerCanvas()
  }, [clearDesktopRulerCanvas, visibleProjects])

  useEffect(() => {
    if (isAboutPage) return
    setLineHitIndex(0)
    setHoveredProjectIndex(-1)
    lineFocusIndexRef.current = -1
    desktopRulerTrackMetricsRef.current = { x: null, width: null }
    desktopRulerPositionsRef.current = []
    desktopRulerMarkerWindowsRef.current = []
    desktopRulerTargetXRef.current = null
    desktopRulerPlayheadXRef.current = null
    desktopRulerTrackWidthRef.current = 0
    clearDesktopRulerCanvas()
    if (scrollGuideLineRef.current) {
      scrollGuideLineRef.current.style.left = '0%'
    }
  }, [clearDesktopRulerCanvas, isAboutPage])

  useEffect(() => {
    if (isMobileViewport || isAboutPage) {
      clearDesktopRulerCanvas()
      return undefined
    }

    let rafId = 0
    const tick = () => {
      drawDesktopRulerCanvas()
      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [clearDesktopRulerCanvas, drawDesktopRulerCanvas, isAboutPage, isMobileViewport])

  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) return

    if (hoveredProjectIndex >= 0 && hoveredProjectIndex < visibleProjects.length) {
      const project = visibleProjects[hoveredProjectIndex]
      handleHoverTitleChange(project?.title || '')
      handleHoverYearChange(project?.year || '')
      return
    }

    const lineFocusIndex = lineFocusIndexRef.current
    if (lineFocusIndex >= 0 && lineFocusIndex < visibleProjects.length) {
      const project = visibleProjects[lineFocusIndex]
      handleHoverTitleChange(project?.title || '')
      handleHoverYearChange(project?.year || '')
      return
    }

    handleHoverTitleChange('')
    handleHoverYearChange('')
  }, [hoveredProjectIndex, visibleProjects, handleHoverTitleChange, handleHoverYearChange])

  const handleScrollProgress = useCallback((progress = 0) => {
    if (!scrollGuideLineRef.current) return
    if (isFilterTransitioning) {
      scrollGuideLineRef.current.style.left = '0%'
      return
    }
    const clamped = Math.max(0, Math.min(1, progress))
    scrollGuideLineRef.current.style.left = `${clamped * 100}%`
  }, [isFilterTransitioning])

  const handleRulerPositionsChange = useCallback((leftPositions = [], focusX = 0) => {
    if (isMobileViewport || !leftPositions?.length || !desktopRulerTrackRef.current) return

    const track = desktopRulerTrackRef.current
    const trackContainer = track.parentElement
    if (!trackContainer) return

    const containerRect = trackContainer.getBoundingClientRect()
    const containerLeft = containerRect.left
    const containerWidth = containerRect.width
    const markers = desktopRulerMarkerRefs.current
    const localPositions = leftPositions.map((left) => left - containerLeft)
    const first = localPositions.find((value) => Number.isFinite(value))
    const last = [...localPositions].reverse().find((value) => Number.isFinite(value))
    if (!Number.isFinite(first) || !Number.isFinite(last) || !Number.isFinite(containerWidth)) {
      return
    }
    const span = Math.max(0, last - first)
    const basePad = 32
    // Keep ruler track rigid so canvas ticks + number markers move as one unit.
    const sidePad = Math.max(basePad, containerWidth)
    const trackWidth = span + sidePad * 2
    const trackX = first - sidePad

    const prevTrack = desktopRulerTrackMetricsRef.current
    if (!Number.isFinite(prevTrack.x) || Math.abs(prevTrack.x - trackX) > 0.01) {
      track.style.transform = `translate3d(${trackX}px,0,0)`
      prevTrack.x = trackX
    }
    if (!Number.isFinite(prevTrack.width) || Math.abs(prevTrack.width - trackWidth) > 0.01) {
      track.style.width = `${trackWidth}px`
      prevTrack.width = trackWidth
    }
    desktopRulerTrackWidthRef.current = trackWidth

    if (Number.isFinite(focusX)) {
      const localFocus = focusX - containerLeft - trackX
      const clampedFocus = Math.max(0, Math.min(trackWidth, localFocus))
      desktopRulerTargetXRef.current = clampedFocus
      if (!Number.isFinite(desktopRulerPlayheadXRef.current)) {
        desktopRulerPlayheadXRef.current = clampedFocus
      }
    }

    const markerLocalStarts = new Array(localPositions.length)
    const markerWidths = new Array(localPositions.length)

    localPositions.forEach((localLeft, index) => {
      const marker = markers[index]
      if (!marker || !Number.isFinite(localLeft)) return

      const prev = desktopRulerPositionsRef.current[index]
      const markerLocalX = localLeft - trackX
      if (!Number.isFinite(prev) || Math.abs(prev - markerLocalX) > 0.18) {
        marker.style.left = `${markerLocalX}px`
        desktopRulerPositionsRef.current[index] = markerLocalX
      }

      markerLocalStarts[index] = markerLocalX
      markerWidths[index] = marker.offsetWidth || 0
      marker.style.opacity = localLeft < -76 || localLeft > containerWidth + 28 ? '0' : '1'
    })

    const windows = []
    for (let i = 0; i < markerLocalStarts.length; i += 1) {
      const start = markerLocalStarts[i]
      const width = markerWidths[i]
      if (!Number.isFinite(start) || !Number.isFinite(width)) continue
      windows.push([
        start - RULER_LINE_NUMBER_GAP,
        start + width + RULER_LINE_NUMBER_GAP,
      ])
    }
    desktopRulerMarkerWindowsRef.current = windows
    drawDesktopRulerCanvas()
  }, [drawDesktopRulerCanvas, isMobileViewport])

  const handleLineFocusChange = useCallback((index) => {
    if (window.matchMedia('(max-width: 768px)').matches) return
    lineFocusIndexRef.current = index
    if (hoveredProjectIndex >= 0) return
    if (index < 0 || index >= visibleProjects.length) {
      handleHoverTitleChange('')
      handleHoverYearChange('')
      return
    }
    const project = visibleProjects[index]
    handleHoverTitleChange(project?.title || '')
    handleHoverYearChange(project?.year || '')
  }, [hoveredProjectIndex, visibleProjects, handleHoverTitleChange, handleHoverYearChange])

  const handleLineHitIndexChange = useCallback((index) => {
    if (!visibleProjects.length) return
    if (index < 0 || index >= visibleProjects.length) return
    setLineHitIndex(index)
  }, [visibleProjects])

  const handleFilterChange = useCallback((nextFilter) => {
    if (nextFilter === filter || isFilterTransitioning || !canvasShellRef.current) return

    const shell = canvasShellRef.current
    if (scrollGuideLineRef.current) {
      scrollGuideLineRef.current.style.left = '0%'
    }
    mainEnterTransitionRef.current?.kill()
    mainEnterTransitionRef.current = null
    gsap.set(shell, { clearProps: 'transform,willChange' })
    filterTransitionRef.current?.kill()
    gsap.killTweensOf(filterWipeRef.current)
    setIsFilterTransitioning(true)
    filterWipeRef.current.direction = -1
    filterWipeRef.current.progress = 0

    const outTl = gsap.timeline({
      onComplete: () => {
        setFilter(nextFilter)
        setHoveredProjectIndex(-1)
        lineFocusIndexRef.current = -1
        handleHoverTitleChange('')
        handleHoverYearChange('')
        setCenteredIndex(0)
        setLineHitIndex(0)

        gsap.set(shell, { xPercent: 100, willChange: 'transform' })
        filterTransitionRef.current = gsap.to(shell, {
          xPercent: 0,
          duration: 0.62,
          ease: 'power3.out',
          onStart: () => {
            gsap.to(filterWipeRef.current, {
              progress: 0,
              duration: 0.62,
              ease: 'power3.out',
            })
          },
          onComplete: () => {
            gsap.set(shell, { clearProps: 'transform,willChange' })
            setIsFilterTransitioning(false)
            filterTransitionRef.current = null
            filterWipeRef.current.progress = 0
          },
        })
      },
    })

    gsap.to(filterWipeRef.current, {
      progress: 1,
      duration: 0.90,
      ease: 'power2.inOut',
    })

    outTl.to(shell, {
      xPercent: -100,
      duration: 0.60,
      ease: 'power2.inOut',
    })
    filterTransitionRef.current = outTl
  }, [filter, handleHoverTitleChange, handleHoverYearChange, isFilterTransitioning])

  useEffect(() => {
    return () => {
      mainEnterTransitionRef.current?.kill()
      mainEnterTransitionRef.current = null
      filterTransitionRef.current?.kill()
      filterTransitionRef.current = null
      headerNavTransitionRef.current?.kill()
      headerNavTransitionRef.current = null
      gsap.killTweensOf(filterWipeRef.current)
      filterWipeRef.current.progress = 0
    }
  }, [])

  return (
    <div className="app-shell">
      {!isAboutPage && showOpeningIntro && (
        <div ref={openingIntroRef} className="opening-intro" aria-hidden="true">
          <div className="opening-intro-title-mask">
            <div ref={openingIntroLineRef} className="opening-intro-title-line">
              JORY WESTRA 2026®
            </div>
          </div>
        </div>
      )}

      <Header
        setFilter={handleFilterChange}
        activeFilter={filter}
        disabled={isFilterTransitioning}
        isAboutPage={isAboutPage}
        onNavigate={handleNavigate}
        isNavigating={isPageTransitioning}
      />

      {isAboutPage && <AboutPage onNavigate={handleNavigate} />}

      {!isAboutPage && (
        <>
          <section className="seo-copy" aria-label="Homepage introduction">
            <h1>Jory Westra Is A Freelance Videographer In Oslo</h1>
            <p>
              Freelance videographer in Oslo creating refined brand films, social content, and
              commercial video for brands, businesses, and people in Oslo and surrounding areas.
            </p>
            <p>
              Jory Westra creates visual storytelling for brands and businesses that want clear,
              polished, and engaging video content in Oslo.
            </p>
          </section>

          {selectedProject && (
            <Suspense fallback={null}>
              <Lightbox
                project={selectedProject}
                originRect={lightboxOriginRect}
                visibleProjects={visibleProjects}
                getProjectRect={getProjectRect}
                onClose={handleLightboxClose}
              />
            </Suspense>
          )}

          {!isMobileViewport && (
            <div className="scroll-ruler" id="scrollRuler">
              <div className="ruler-track ruler-track--desktop">
                <div ref={desktopRulerTrackRef} className="ruler-scroll-track" aria-hidden="true">
                  <canvas ref={desktopRulerCanvasRef} className="ruler-canvas" />
                  {visibleProjects.map((project, index) => (
                    <span
                      key={project.id}
                      ref={(node) => {
                        desktopRulerMarkerRefs.current[index] = node
                      }}
                      className={index === lineHitIndex ? 'ruler-index-marker is-active' : 'ruler-index-marker'}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mobile-sticky-meta" aria-live="polite">
            <div className="mobile-sticky-title">{activeProject?.title || ''}</div>
            <div className="mobile-sticky-year">{activeProject?.year || '2025'}</div>
          </div>

          <div className="scroll-progress-guide" aria-hidden="true">
            <div className="scroll-progress-line" ref={scrollGuideLineRef} />
          </div>

          <div className="hover-title-screen" id="hoverTitleScreen" ref={hoverWrapRef}>
            <div className="hover-title-mask">
              <div className="hover-title-line" ref={hoverLineRef} />
            </div>
          </div>
          <div className="hover-year-screen" id="hoverYearScreen" ref={hoverYearWrapRef}>
            <div className="hover-title-mask">
              <div className="hover-title-line" ref={hoverYearLineRef} />
            </div>
          </div>

          <div ref={canvasShellRef} className="app-canvas-shell">
            {(hasOpeningIntroEntered || !showOpeningIntro) && (
              <Suspense fallback={null}>
                <HomeCanvas
                  filter={filter}
                  scrollPages={scrollPages}
                  visibleProjects={visibleProjects}
                  runtimeById={runtimeById}
                  onRuntimeChange={handleRuntimeChange}
                  onReady={handleCarouselReady}
                  openingProjectId={openingProjectId}
                  onRegisterProjectRectGetter={handleRegisterProjectRectGetter}
                  onHoveredProjectChange={setHoveredProjectIndex}
                  onSelect={(project, originRect) => {
                    if (openDelayTimerRef.current) {
                      window.clearTimeout(openDelayTimerRef.current)
                    }
                    setOpeningProjectId(project.id)
                    setLightboxOriginRect(originRect || null)
                    openDelayTimerRef.current = window.setTimeout(() => {
                      setSelectedProject(project)
                      openDelayTimerRef.current = null
                    }, 220)
                  }}
                  onActiveIndexChange={setCenteredIndex}
                  onScrollProgress={handleScrollProgress}
                  onLineFocusChange={handleLineFocusChange}
                  onLineHitIndexChange={handleLineHitIndexChange}
                  onRulerPositionsChange={handleRulerPositionsChange}
                  filterWipeRef={filterWipeRef}
                />
              </Suspense>
            )}
          </div>
        </>
      )}
    </div>
  )
}
