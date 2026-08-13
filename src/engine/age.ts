import type { Person, SimulationYear } from './plan'

/** Det kalenderår en person når en alder. Formlen er
    `birthYear + floor(age + (birthMonth − 1) / 12)`: den lægger fødselsdagens
    plads i året til alderen og skærer resten væk, så et halvt år skubber
    årstallet over årsskiftet for de fødselsmåneder, hvor det skal.

    En heltalsalder giver `birthYear + age` for enhver fødselsmåned, fordi
    `(birthMonth − 1) / 12` altid er under 1 — den tidligere adfærd er dermed
    formlens specialtilfælde og ikke en regel ved siden af den. Brøkaldre er
    ikke en kuriositet: den lovfastsatte folkepensionsalder er 65,5, 66,5,
    71,5, 72,5 og 73,5 for hver sin årgang. */
export function yearAtAge(person: Person, age: number): SimulationYear {
  return person.birthYear + Math.floor(age + (person.birthMonth - 1) / 12)
}
