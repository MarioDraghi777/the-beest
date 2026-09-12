import { render } from 'preact';
import { App } from './app';
import './styles/global.css';

const host = document.getElementById('app');
if (host) render(<App />, host);
