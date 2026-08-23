import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/ui/testSetup.ts'],
    // Fladens tests kører hele appen i jsdom, og opsætningen alene tager
    // omkring tre minutter for de 29 filer. Ved vitests standardgrænse på
    // fem sekunder falder tilfældige tests i App.test.tsx derfor ud med en
    // timeout, der intet har at gøre med det, de prøver — og en suite, der
    // fejler forskellige steder fra kørsel til kørsel, kan ikke bruges til
    // at afgøre, om en ændring er god. Prisen er, at en test, der reelt
    // hænger, er et halvt minut om at sige det.
    testTimeout: 30_000,
  },
})
