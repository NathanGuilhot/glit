import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, extendTheme, type ThemeConfig } from '@chakra-ui/react'
import App from './App'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    mono: `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`,
  },
  colors: {
    brand: {
      50: '#e8f4fd',
      100: '#bee3f8',
      200: '#90cdf4',
      300: '#63b3ed',
      400: '#4299e1',
      500: '#3182ce',
      600: '#2b6cb0',
      700: '#2c5282',
      800: '#2a4365',
      900: '#1A365D',
    },
    glass: {
      100: 'rgba(255,255,255,0.05)',
      200: 'rgba(255,255,255,0.08)',
      300: 'rgba(255,255,255,0.12)',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.900',
        color: 'whiteAlpha.900',
      },
      '::-webkit-scrollbar': {
        width: '6px',
        height: '6px',
      },
      '::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '::-webkit-scrollbar-thumb': {
        background: 'whiteAlpha.200',
        borderRadius: '3px',
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: 'whiteAlpha.300',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'md',
        fontFamily: 'mono',
        fontSize: 'xs',
      },
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)
