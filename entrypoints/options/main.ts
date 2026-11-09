import { mount } from 'svelte';
import Options from './Options.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Options mount point is missing.');
mount(Options, { target });
