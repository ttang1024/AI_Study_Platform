import React from 'react';
import CodeCell from '../../components/practice/CodeCell';

const STARTER_CODE = `# A worked example. Edit it and press Run.
def fizzbuzz(n):
    if n % 15 == 0:
        return "FizzBuzz"
    if n % 3 == 0:
        return "Fizz"
    if n % 5 == 0:
        return "Buzz"
    return str(n)


for i in range(1, 16):
    print(fizzbuzz(i))
`;

const STARTER_TESTS = `assert fizzbuzz(3) == "Fizz"
assert fizzbuzz(5) == "Buzz"
assert fizzbuzz(15) == "FizzBuzz"
assert fizzbuzz(7) == "7"
print("checks passed")
`;

/** The Code tab of Study tools — a Pyodide scratchpad that runs in the browser. */
export const CodeTab: React.FC = () => (
  <div className="space-y-3 max-w-3xl">
    <p className="text-sm text-text-muted">
      Python runs entirely in your browser — nothing you write here is sent anywhere. The first
      run downloads the interpreter, so it takes a few seconds; later runs are instant.
    </p>
    <CodeCell prompt="Make all four checks pass." initialCode={STARTER_CODE} tests={STARTER_TESTS} />
  </div>
);

export default CodeTab;
