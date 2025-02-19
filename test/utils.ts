import type { Expression } from '../src/math-json/math-json-format';
import { ParsingDiagnostic } from '../src/point-free-parser/parsers';
import { ComputeEngine } from '../src/compute-engine';
import { MISSING } from '../src/common/utils';
import { parseCortex } from '../src/cortex';
import { Form } from '../src/math-json/compute-engine-interface';
import { LatexSyntax } from '../src/math-json/latex-syntax';

let errors: string[] = [];

// const defaultLatex = new LatexSyntax({
//   onError: (warnings) => {
//     for (const warning of warnings) errors.push(warning.message.toString());
//   },
// });
const rawLatex = new LatexSyntax({
  parseArgumentsOfUnknownLatexCommands: false,
  parseUnknownToken: () => 'symbol',
  dictionary: [],
});

export const engine = new ComputeEngine();

export function expression(
  latex: string,
  options?: { form: Form }
): Expression | null {
  errors = [];
  const result = engine.format(engine.parse(latex), options?.form);
  errors = errors.filter((x) => !/^unknown-symbol /.test(x));
  if (errors.length !== 0) return [result ?? MISSING, ...errors];
  return result;
}

export function latex(expr: Expression | undefined | null): string {
  if (expr === undefined) return 'undefined';
  if (expr === null) return 'null';

  errors = [];
  let result = '';
  try {
    result = engine.serialize(expr);
  } catch (e) {
    errors.push(e.toString());
  }
  if (errors.length !== 0) return errors.join('\n');
  return result;
}

export function expressionError(latex: string): string | string[] {
  errors = [];
  engine.parse(latex);
  return errors.length === 1 ? errors[0] : errors;
}

export function rawExpression(latex: string): Expression {
  errors = [];
  return JSON.stringify(engine.format(rawLatex.parse(latex), ['json']));
}

export function printExpression(expr: Expression): string {
  if (Array.isArray(expr)) {
    return '[' + expr.map((x) => printExpression(x)).join(', ') + ']';
  }
  if (typeof expr === 'string') {
    return `'${expr}'`;
  }
  if (typeof expr === 'undefined') {
    return 'undefined';
  }
  if (expr === null) {
    return 'null';
  }
  if (typeof expr === 'object') {
    return (
      '{' +
      Object.keys(expr)
        .map((x) => x + ': ' + printExpression(expr[x]))
        .join(', ') +
      '}'
    );
  }
  return expr.toString();
}

// beforeEach(() => {
//   jest.spyOn(console, 'assert').mockImplementation((assertion) => {
//     if (!assertion) debugger;
//   });
//   jest.spyOn(console, 'log').mockImplementation(() => {
//     debugger;
//   });
//   jest.spyOn(console, 'warn').mockImplementation(() => {
//     debugger;
//   });
//   jest.spyOn(console, 'info').mockImplementation(() => {
//     debugger;
//   });
// });
expect.addSnapshotSerializer({
  // test: (val): boolean => Array.isArray(val) || typeof val === 'object',
  test: (_val): boolean => true,

  serialize: (val, _config, _indentation, _depth, _refs, _printer): string => {
    return printExpression(val);
  },
});

function isValidJSONNumber(num: string): string | number {
  if (typeof num === 'string') {
    const val = Number(num);
    if (num[0] === '+') num = num.slice(1);
    if (val.toString() === num) {
      // If the number roundtrips, it can be represented by a
      // JavaScript number
      // However, NaN and Infinity cannot be represented by JSON
      if (isNaN(val)) return 'NaN';
      if (!isFinite(val) && val < 0) return '-Infinity';
      if (!isFinite(val) && val > 0) return '+Infinity';
      return val;
    }
  }
  return num;
}

export function strip(expr: Expression): Expression | null {
  if (typeof expr === 'number') return expr;
  if (typeof expr === 'string') {
    if (expr[0] === "'" && expr[expr.length - 1] === "'") {
      return { str: expr.slice(1, -1) };
    }
    return expr;
  }
  if (Array.isArray(expr))
    return expr.map((x) => strip(x ?? MISSING) ?? MISSING);

  if (typeof expr === 'object') {
    if ('num' in expr) {
      const val = isValidJSONNumber(expr.num);
      if (typeof val === 'number') return val;
      return { num: val };
    } else if ('sym' in expr) {
      return expr.sym;
    } else if ('fn' in expr) {
      return expr.fn.map((x) => strip(x ?? MISSING) ?? MISSING);
    } else if ('dict' in expr) {
      return {
        dict: Object.fromEntries(
          Object.entries(expr.dict).map((keyValue) => {
            return [keyValue[0], strip(keyValue[1]) ?? MISSING];
          })
        ),
      };
    } else if ('str' in expr) {
      return { str: expr.str };
    } else {
      console.log('Unexpected object literal as an Expression');
    }
  }

  return null;
}

export function formatError(errors: ParsingDiagnostic[]): Expression {
  return [
    'Error',
    ...errors.map((x) => {
      // If we have an array as the last element, it's the trace. Remove it.
      if (
        Array.isArray(x.message) &&
        Array.isArray(x.message[x.message.length - 1])
      ) {
        return x.message.slice(0, -1);
      }

      return x.message;
    }),
  ];
}

export function validCortex(s: string): Expression | null {
  const [value, errors] = parseCortex(s);
  if (errors && errors.length > 0) return formatError(errors);
  return strip(value);
}

export function invalidCortex(s: string): Expression | null {
  const [value, errors] = parseCortex(s);
  if (errors && errors.length > 0) return formatError(errors);
  return ['UnexpectedSuccess', strip(value as Expression) ?? MISSING];
}
