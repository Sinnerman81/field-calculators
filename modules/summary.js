/**
 * Builds the "Copy Summary as Markdown" report body. Pure so it can be tested
 * and reused by any calculator without touching the DOM or clipboard.
 */
import { outputValue } from './format.js';

function formatTimestamp(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function buildSummaryMarkdown({
  title,
  category,
  inputs = [],
  result,
  generatedAt = new Date(),
  appName = 'FieldKit',
}) {
  if (!title) throw new TypeError('A summary needs a title.');
  if (!result || result.ok !== true) {
    throw new TypeError('A summary needs a successful result.');
  }

  const lines = [`## ${title}`, ''];

  if (category) lines.push(`**Category:** ${category}`);
  lines.push(`**Generated:** ${formatTimestamp(generatedAt)}`, '');

  lines.push('### Inputs');
  if (inputs.length === 0) {
    lines.push('- —');
  } else {
    for (const input of inputs) {
      const suffix = input.unit ? ` ${input.unit}` : '';
      lines.push(`- **${input.label}:** ${input.value}${suffix}`);
    }
  }
  lines.push('', '### Results');

  const outputs = Array.isArray(result.outputs) ? result.outputs : [];
  if (outputs.length === 0) {
    lines.push('- —');
  } else {
    for (const output of outputs) {
      const suffix = output.unit ? ` ${output.unit}` : '';
      lines.push(`- **${output.label}:** ${outputValue(output)}${suffix}`);
    }
  }

  if (result.status?.label) {
    lines.push('', `**Status:** ${result.status.label}`);
  }

  if (Array.isArray(result.notes) && result.notes.length > 0) {
    lines.push('', '### Assumptions');
    for (const note of result.notes) lines.push(`- ${note}`);
  }

  lines.push('', '---', `_${appName} — offline field calculators_`);
  return `${lines.join('\n')}\n`;
}
