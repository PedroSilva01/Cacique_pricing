// Utilitários de análise estatística (sem dependências externas)

/**
 * Calcula a correlação de Pearson entre dois conjuntos de valores numéricos
 * presentes em um array de objetos.
 *
 * @param {Array<object>} points - Lista de pontos com os campos xKey e yKey.
 * @param {Object} options
 * @param {string} options.xKey - Nome da propriedade usada como eixo X.
 * @param {string} options.yKey - Nome da propriedade usada como eixo Y.
 * @param {number} [options.minPoints=2] - Quantidade mínima de pontos válidos.
 * @returns {{ r: number, strength: string, direction: string, points: number } | null}
 */
export function computePearsonCorrelation(points, { xKey, yKey, minPoints = 2 } = {}) {
  if (!Array.isArray(points) || !points.length || !xKey || !yKey) {
    return null;
  }

  const cleaned = points
    .map((p) => {
      const x = Number(p[xKey]);
      const y = Number(p[yKey]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    })
    .filter(Boolean);

  const n = cleaned.length;
  if (n < minPoints) return null;

  let sumX = 0;
  let sumY = 0;
  cleaned.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
  });

  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;

  cleaned.forEach(({ x, y }) => {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  });

  if (denomX === 0 || denomY === 0) return null;

  const r = num / Math.sqrt(denomX * denomY);
  if (!Number.isFinite(r)) return null;

  const abs = Math.abs(r);
  let strength = 'fraca';
  if (abs >= 0.7) strength = 'forte';
  else if (abs >= 0.4) strength = 'moderada';

  const direction = r >= 0 ? 'positiva' : 'negativa';

  return { r, strength, direction, points: n };
}
