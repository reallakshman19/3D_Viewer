// Registry wrapper for the SELF-CONTAINED Input XML -> AVEVA RVM converter.
// The actual runner and all of its logic live under viewer/converters/inputxml-rvm/
// as vendored, Rvmx-prefixed copies that import no shared viewer modules.
export { run } from '../../../converters/inputxml-rvm/inputxml-to-rvm-runner.js';
