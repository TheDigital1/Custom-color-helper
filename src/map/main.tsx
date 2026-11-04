import { render } from 'preact';
import { MapApp } from './MapApp';
import '../styles.css';
import './map.css';

render(<MapApp />, document.getElementById('app')!);
