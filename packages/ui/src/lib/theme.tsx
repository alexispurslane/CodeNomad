import { createContext, createEffect, createSignal, onMount, useContext, type JSX } from "solid-js"
import { useConfig } from "../stores/preferences"

interface ThemeContextValue {
  isDark: () => boolean
  toggleTheme: () => void
  setTheme: (dark: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue>()

function applyTheme(dark: boolean) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark")
    return
  }

  document.documentElement.removeAttribute("data-theme")
}

export function ThemeProvider(props: { children: JSX.Element }) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)")
  const { themePreference, setThemePreference } = useConfig()
  const [isDark, setIsDarkSignal] = createSignal(false)

  const resolveDarkTheme = () => {
    const preference = themePreference()
    if (preference === "system") {
      return systemPrefersDark.matches
    }
    return preference === "dark"
  }

  const applyResolvedTheme = () => {
    const dark = resolveDarkTheme()
    setIsDarkSignal(dark)
    applyTheme(dark)
  }

  createEffect(() => {
    applyResolvedTheme()
  })

  onMount(() => {
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (themePreference() === "system") {
        setIsDarkSignal(event.matches)
        applyTheme(event.matches)
      }
    }

    systemPrefersDark.addEventListener("change", handleSystemThemeChange)

    return () => {
      systemPrefersDark.removeEventListener("change", handleSystemThemeChange)
    }
  })

  const setTheme = (dark: boolean) => {
    setThemePreference(dark ? "dark" : "light")
  }

  const toggleTheme = () => {
    setTheme(!isDark())
  }

  return <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme }}>{props.children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
