import { couple } from '../eval/fixtures.js';
import { allowedFigures, figuresIn, inventedFigures } from './figures.js';
import { detectAll } from './findings.js';

describe('figures guard', () => {
  it('reads Spanish number formats as numbers', () => {
    expect(figuresIn('Ahorras 1.234,50 € (o 1 234,5) al 21,9 % en 3 meses')).toEqual([
      '1234.5',
      '1234.5',
      '21.9',
      '3',
    ]);
  });

  const allowed = allowedFigures(detectAll(couple), 'EUR');

  it('accepts texts that only reuse the data figures, however they are spaced', () => {
    expect(inventedFigures('Cancela Netflix Básico y ahorra 6,99 € al mes.', allowed)).toEqual([]);
    expect(inventedFigures('Llevas 435 € en Comida, 35 € por encima.', allowed)).toEqual([]);
    expect(inventedFigures('Al 21,9 % de interés esta tarjeta sale cara.', allowed)).toEqual([]);
  });

  it('catches invented, rounded or computed figures', () => {
    expect(inventedFigures('Ahorrarías unos 7 € al mes.', allowed)).toEqual(['7']);
    expect(inventedFigures('Eso son 83,88 € al año.', allowed)).toEqual(['83.88']);
    expect(inventedFigures('Gastas un 158 % más en ocio.', allowed)).toEqual(['158']);
  });
});
