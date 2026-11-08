import { mount } from 'svelte';
import Popup from './Popup.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Popup mount point is missing.');
mount(Popup, { target });
