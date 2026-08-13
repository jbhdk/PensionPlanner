import { describe, expect, it } from 'vitest'
import { aPlan } from './testing/planFixture'
import { deriveStatePensionAge, statePensionAge, statePensionYear } from './statePensionAge'

describe('deriveStatePensionAge', () => {
  it('udleder folkepensionsalderen for en fødselsdato midt i et vedtaget trin', () => {
    expect(deriveStatePensionAge(1973, 6)).toEqual({ age: 70, enacted: true })
  })

  it('rammer den rigtige måned, når et trin skifter midt i et fødselsår', () => {
    expect(deriveStatePensionAge(1955, 6)).toEqual({ age: 66.5, enacted: true })
    expect(deriveStatePensionAge(1955, 7)).toEqual({ age: 67, enacted: true })
  })

  it('markerer fødselsår efter det sidst vedtagne trin som et skøn', () => {
    expect(deriveStatePensionAge(1985, 1)).toEqual({ age: 72.5, enacted: false })
  })

  it('bruger det sidste kendte trin for fødselsår efter den offentliggjorte fremskrivning', () => {
    expect(deriveStatePensionAge(2010, 1)).toEqual({ age: 74, enacted: false })
  })
})

describe('statePensionAge', () => {
  it('bruger tabellens alder for personens fødselsdato', () => {
    const [person] = aPlan({ birthYear: 1973 }).household.persons
    expect(statePensionAge(person!)).toBe(70)
  })

  it('bruger også tabellen, når trinnet kun er fremskrevet og ikke vedtaget', () => {
    // Skønnet er det bedste tal, der findes, og personen har intet håndtag
    // at sætte ved siden af det.
    const [person] = aPlan({ birthYear: 1985 }).household.persons
    expect(statePensionAge(person!)).toBe(72.5)
  })
})

describe('statePensionYear', () => {
  const aPerson = (birthYear: number, birthMonth: number) =>
    aPlan({ birthYear, birthMonth }).household.persons[0]!

  it('skubber året over årsskiftet for de fødselsmåneder, hvor det halve år rækker', () => {
    // Folkepensionsalderen er 72,5 for hele årgang 1983. En januarfødt når
    // den i juli 2055, mens en julifødt først når den i januar 2056.
    expect(statePensionYear(aPerson(1983, 1))).toBe(2055)
    expect(statePensionYear(aPerson(1983, 7))).toBe(2056)
  })

  it('giver fødselsåret plus alderen, når folkepensionsalderen er et helt år', () => {
    expect(statePensionYear(aPerson(1973, 6))).toBe(2043)
  })
})
