/**
 * @fileoverview Tests for no-inline-multiline-types rule.
 * @author tuomashatakka
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import rule from "../../../lib/rules/no-inline-multiline-types.mjs";
import { RuleTester } from "eslint";
import typescriptEslintParser from "@typescript-eslint/parser";

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

const ruleTester = new RuleTester({
  languageOptions: {
    parser: typescriptEslintParser,
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
    }
  }
});

ruleTester.run("no-inline-multiline-types", rule, {
  valid: [
    // Using a named interface/type (preferred)
    `interface BtnProps { submitForm: () => void; input: string; }
     function Button(props: BtnProps) {}`,
    `type Cfg = { host: string; port: number; };
     let config: Cfg;`,

    // Multiline type/interface *definitions* are allowed
    `
    type ComplexData = {
        id: number;
        name: string;
        details: { // Nested single-line is fine
            isValid: boolean;
        }
    };
    `,
    `
    interface MoreComplexData {
        id: number;
        name: string;
        details: {
            isValid: boolean;
        }
    }
    `,
    // Multiline TSTypeLiteral *within* a type alias definition is allowed
    `
    type Wrapper = {
        kind: 'wrapper';
        content: { // This multiline literal is part of the definition structure
            text: string;
            value: number;
        }
    }
    `,
    // Multiline TSTypeLiteral *within* an interface definition is allowed
    `
    interface IWrapper {
        kind: 'wrapper';
        content: { // This multiline literal is part of the definition structure
            text: string;
            value: number;
        }
    }
    `,
  ],

  invalid: [
    // Single line inline type annotation - now invalid
    {
      code: `function Button({ label, onClick }: { label: string; onClick: () => void }) {}`,
      output: `type ButtonProps = { label: string; onClick: () => void };\n\nfunction Button({ label, onClick }: ButtonProps) {}`,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 1, column: 37 }],
    },
    {
      code: `let cfg: { host: string; port: number };`,
      output: `type CfgType = { host: string; port: number };\n\nlet cfg: CfgType;`,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 1, column: 10 }],
    },
    {
      code: `function getCfg(): { host: string; port: number } { return {host:'', port:0}; }`,
      output: `type GetCfgReturnType = { host: string; port: number };\n\nfunction getCfg(): GetCfgReturnType { return {host:'', port:0}; }`,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 1, column: 20 }],
    },
    {
      code: `class C { prop: { x: number; y: string }; }`,
      output: `type PropType = { x: number; y: string };\n\nclass C { prop: PropType; }`,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 1, column: 17 }],
    },
    {
      code: `class D { constructor(p: { x: number }) {} }`,
      output: `type PType = { x: number };\n\nclass D { constructor(p: PType) {} }`,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 1, column: 26 }],
    },

    // Multiline inline type in variable declaration annotation
    {
      code: `
      let myConfig: { // TSTypeLiteral starts here
        host: string;
        port: number;
        debug?: boolean;
      };
      `,
      output: `
      type MyConfigType = { // TSTypeLiteral starts here
        host: string;
        port: number;
        debug?: boolean;
      };

let myConfig: MyConfigType;
      `, // Note: Exact whitespace might differ slightly based on fixer behavior
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 2, column: 21 }],
    },
    // Multiline inline type in function parameter annotation
    {
      code: `
      function PureSendButton ({
        submitForm,
        input,
        uploadQueue,
      }: {
        submitForm:  () => void;
        input:       string;
        uploadQueue: Array<string>;
      }) {}
      `,
      output: `
      type PureSendButtonProps = {
        submitForm:  () => void;
        input:       string;
        uploadQueue: Array<string>;
      };

function PureSendButton ({
        submitForm,
        input,
        uploadQueue,
      }: PureSendButtonProps) {}
      `,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 6, column: 10 }],
    },
    // Multiline inline type in return type annotation
    {
      code: `
      function fetchData(): {
        data: string[];
        error: Error | null;
        status: number;
      } {
        return { data: [], error: null, status: 200 };
      }
      `,
      output: `
      type FetchDataReturnType = {
        data: string[];
        error: Error | null;
        status: number;
      };

function fetchData(): FetchDataReturnType {
        return { data: [], error: null, status: 200 };
      }
      `,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 2, column: 29 }],
    },
    // Multiline inline type in constructor parameter property annotation
    {
      code: `
      class MyClass {
        constructor(
          private config: { // TSTypeLiteral starts here
            url: string;
            retries: number;
          }
        ) {}
      }
      `,
      output: `
      type ConfigType = { // TSTypeLiteral starts here
            url: string;
            retries: number;
          };

class MyClass {
        constructor(
          private config: ConfigType
        ) {}
      }
      `,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 4, column: 27 }],
    },
    // Multiline inline type in class property annotation
    {
      code: `
      class AnotherClass {
          options: { // TSTypeLiteral starts here
              enabled: boolean;
              timeout: number;
          };
      }
      `,
      output: `
      type OptionsType = { // TSTypeLiteral starts here
              enabled: boolean;
              timeout: number;
          };

class AnotherClass {
          options: OptionsType;
      }
      `,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 3, column: 20 }],
    },
    // Test with export
    {
      code: `
      export const getConfig = (): {
          debug: boolean,
          level: 'info' | 'warn'
      } => {
          return { debug: true, level: 'info' };
      };
      `,
      output: `
      type GetConfigReturnType = {
          debug: boolean,
          level: 'info' | 'warn'
      };

export const getConfig = (): GetConfigReturnType => {
          return { debug: true, level: 'info' };
      };
      `,
      errors: [{ messageId: "inlineType", type: "TSTypeLiteral", line: 2, column: 36 }],
    }
  ],
});

console.log("Tests completed.");