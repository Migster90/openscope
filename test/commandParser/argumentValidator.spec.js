/* eslint-disable arrow-parens, max-len, import/no-extraneous-dependencies*/
import ava from 'ava';

import {
    zeroArgumentsValidator,
    singleArgumentValidator,
    zeroOrOneArgumentValidator,
    oneOrTwoArgumentValidator,
    altitudeValidator,
    headingValidator
} from '../../src/assets/scripts/commandParser/argumentValidators';

ava('.zeroArgumentsValidator() returns a string when passed the wrong number of arguments', t => {
    let result = zeroArgumentsValidator([]);
    t.true(typeof result === 'undefined');

    result = zeroArgumentsValidator(['', '']);
    t.true(result === 'Invalid argument length. Expected exactly zero arguments');
});

ava('.singleArgumentValidator() returns a string when passed the wrong number of arguments', t => {
    let result = singleArgumentValidator(['']);
    t.true(typeof result === 'undefined');

    result = singleArgumentValidator(['', '']);
    t.true(result === 'Invalid argument length. Expected exactly one argument');

    result = singleArgumentValidator([]);
    t.true(result === 'Invalid argument length. Expected exactly one argument');
});

ava('.zeroOrOneArgumentValidator() returns a string when passed the wrong number of arguments', t => {
    let result = zeroOrOneArgumentValidator();
    t.true(typeof result === 'undefined');

    result = zeroOrOneArgumentValidator(['']);
    t.true(typeof result === 'undefined');

    result = zeroOrOneArgumentValidator(['', '']);
    t.true(result === 'Invalid argument length. Expected zero or one argument');
});

ava('.oneOrTwoArgumentValidator() returns a string when passed the wrong number of arguments', t => {
    let result = oneOrTwoArgumentValidator(['']);
    t.true(typeof result === 'undefined');

    result = oneOrTwoArgumentValidator(['', '']);
    t.true(typeof result === 'undefined');

    result = oneOrTwoArgumentValidator();
    t.true(result === 'Invalid argument length. Expected one or two arguments');

    result = oneOrTwoArgumentValidator(['', '', '']);
    t.true(result === 'Invalid argument length. Expected one or two arguments');
});

ava('.altitudeValidator() returns a string when passed the wrong number of arguments', t => {
    let result = altitudeValidator(['']);
    t.true(typeof result === 'undefined');

    result = altitudeValidator(['', 'expedite']);
    t.true(typeof result === 'undefined');

    result = altitudeValidator([]);
    t.true(result === 'Invalid argument length. Expected one or two arguments');

    result = altitudeValidator(['', '', '']);
    t.true(result === 'Invalid argument length. Expected one or two arguments');
});

ava('.altitudeValidator() returns a string when passed anything other than expedite or x as the second argument', t => {
    let result = altitudeValidator(['', 'expedite']);
    t.true(typeof result === 'undefined');

    result = altitudeValidator(['', '']);
    t.true(result === 'Invalid argument. Altitude accepts only "expedite" or "x" as a second argument');
});

ava('.headingValidator() returns a string when passed the wrong number of arguments', t => {
    let result = headingValidator(['042']);
    t.true(typeof result === 'undefined');

    result = headingValidator(['l', '42']);
    t.true(typeof result === 'undefined');

    result = headingValidator(['l', '42', true]);
    t.true(typeof result === 'undefined');

    result = headingValidator([]);
    t.true(result === 'Invalid argument length. Expected one, two, or three arguments');

    result = headingValidator(['', '', '', '']);
    t.true(result === 'Invalid argument length. Expected one, two, or three arguments');
});

ava('.headingValidator() returns a string when passed the wrong type of arguments', t => {
    t.true(headingValidator(['threeve']) === 'Invalid argument. Heading must be a number');
    t.true(headingValidator(['42', '42']) === 'Invalid argument. Expected one of \'left / l / right / r\' as the first argument when passed three arguments');
    t.true(headingValidator(['l', 'threeve']) === 'Invalid argument. Heading must be a number');
    t.true(headingValidator(['42', '42', true]) === 'Invalid argument. Expected one of \'left / l / right / r\' as the first argument when passed three arguments');
    t.true(headingValidator(['l', 'threeve', true]) === 'Invalid argument. Heading must be a number');
    t.true(headingValidator(['l', '42', 'threeve']) === 'Invalid argument. Heading accepts a boolean for the third argument when passed three arguments');
});

ava('.headingValidator() returns undefined when passed a number as a single argument', t => {
    const result = headingValidator(['042']);
    t.true(typeof result === 'undefined');
});

ava('.headingValidator() returns undefined when passed a string and a number as arguments', t => {
    const result = headingValidator(['l', '042']);
    t.true(typeof result === 'undefined');
});

ava('.headingValidator() returns undefined when passed a string, number and boolean as arguments', t => {
    const result = headingValidator(['l', '042', true]);
    t.true(typeof result === 'undefined');
});
