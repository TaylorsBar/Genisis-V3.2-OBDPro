import { OpticalFlowProcessor, TrackedPoint } from '../services/OpticalFlowProcessor';

const processor = new OpticalFlowProcessor();

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        const { width, height } = payload;
        processor.init(width, height);
        self.postMessage({ type: 'INIT_DONE' });
    } else if (type === 'DETECT_FEATURES') {
        const { imageData, maxPoints } = payload;
        const features = processor.detectFeatures(imageData, maxPoints);
        self.postMessage({ type: 'FEATURES_DETECTED', payload: features });
    } else if (type === 'TRACK_FEATURES') {
        const { imageData, features } = payload;
        const trackedFeatures = processor.trackFeatures(imageData, features);
        self.postMessage({ type: 'FEATURES_TRACKED', payload: trackedFeatures });
    }
};
