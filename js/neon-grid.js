// ------ ------ ------ ------ ------ ------ 
// js/neon-grid.js - 3D Neon tunnel background animation with Eco Mode support
// ------ ------ ------ ------ ------ ------ 

export function initNeonGrid() {
    const canvas = document.getElementById('neon-grid');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;
    let animationId = null;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    // 1. Initialize all tunnel data structures in memory immediately
    let time = 0;
    const focalLength = 480;
    const ringCount = 28;
    const ringSpacing = 65;
    const tunnelRadius = 360;
    const segments = 20;
    const tunnelSpeed = 2.0;

    const tunnelColor = '#00a2ff';
    const particleColor = '#33b5ff';

    const rings = Array.from({ length: ringCount }, (_, i) => ({
        z: i * ringSpacing + 40,
        index: i
    }));

    const particles = Array.from({ length: 90 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radiusOffset: Math.random() * tunnelRadius * 0.85,
        z: Math.random() * (ringCount * ringSpacing),
        speed: 2.8
    }));

    let pulseTimer = 0;
    let activePulseZ = -1000;
    const segmentAngles = Array.from({ length: segments }, (_, s) => (s / segments) * Math.PI * 2);

    // 2. Main animation loop function
    function animate() {
        if (isLowPerf) return;

        time += 0.014;
        
        pulseTimer += 0.014;
        if (pulseTimer > 4.5) {
            pulseTimer = 0;
            activePulseZ = ringCount * ringSpacing;
        }

        if (activePulseZ > -100) {
            activePulseZ -= tunnelSpeed * 2.8;
        }

        ctx.fillStyle = '#030712';
        ctx.fillRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;

        const maxDim = Math.max(width, height);
        const bgGrad = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, maxDim * 0.8);
        bgGrad.addColorStop(0, 'rgba(0, 162, 255, 0.14)');
        bgGrad.addColorStop(0.5, 'rgba(0, 90, 200, 0.04)');
        bgGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        rings.forEach(ring => {
            ring.z -= tunnelSpeed;
            if (ring.z < 20) {
                ring.z += ringCount * ringSpacing;
            }
        });

        rings.sort((a, b) => b.z - a.z);
        const totalDepth = ringCount * ringSpacing;
        const globalRotation = time * 0.5;

        const projectedRings = rings.map(ring => {
            const points = new Array(segments);
            const radiusScale = tunnelRadius * (focalLength / ring.z);
            
            for (let s = 0; s < segments; s++) {
                const theta = segmentAngles[s] + globalRotation;
                points[s] = {
                    x: centerX + Math.cos(theta) * radiusScale,
                    y: centerY + Math.sin(theta) * radiusScale
                };
            }
            return { z: ring.z, points: points, index: ring.index };
        });

        ctx.lineWidth = 0.85;
        for (let i = 0; i < projectedRings.length - 1; i++) {
            const r1 = projectedRings[i];
            const r2 = projectedRings[i + 1];
            
            if (Math.abs(r1.z - r2.z) <= ringSpacing * 1.4) {
                const progress = r1.z / totalDepth;
                const alpha = Math.min(0.18, Math.max(0.005, progress * 0.22));
                const distanceToPulse = Math.abs(r1.z - activePulseZ);
                const isPulseActive = distanceToPulse < 80;
                
                if (isPulseActive) {
                    const pulseIntensity = 1 - (distanceToPulse / 80);
                    ctx.strokeStyle = '#00ffff';
                    ctx.globalAlpha = Math.min(0.85, alpha + pulseIntensity * 0.6);
                    ctx.lineWidth = 1.6;
                } else {
                    ctx.strokeStyle = tunnelColor;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = 0.85;
                }

                ctx.beginPath();
                for (let s = 0; s < segments; s++) {
                    ctx.moveTo(r1.points[s].x, r1.points[s].y);
                    ctx.lineTo(r2.points[s].x, r2.points[s].y);
                }
                ctx.stroke();
            }
        }

        projectedRings.forEach(ring => {
            const progress = ring.z / totalDepth;
            const alpha = Math.min(0.30, Math.max(0.01, progress * 0.35));
            const distanceToPulse = Math.abs(ring.z - activePulseZ);
            const isPulseActive = distanceToPulse < 80;

            if (isPulseActive) {
                const pulseIntensity = 1 - (distanceToPulse / 80);
                ctx.strokeStyle = '#00ffff';
                ctx.globalAlpha = Math.min(0.95, alpha + pulseIntensity * 0.7);
                ctx.lineWidth = 2.0;
            } else {
                ctx.strokeStyle = tunnelColor;
                ctx.globalAlpha = alpha;
                ctx.lineWidth = 1.0;
            }

            ctx.beginPath();
            ring.points.forEach((pt, idx) => {
                if (idx === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            });

            ctx.closePath();
            ctx.stroke();
        });

        ctx.fillStyle = particleColor;
        particles.forEach(p => {
            p.z -= p.speed;
            if (p.z <= 20) {
                p.z += totalDepth;
                p.angle = Math.random() * Math.PI * 2;
                p.radiusOffset = Math.random() * tunnelRadius * 0.85;
            }

            const scale = focalLength / p.z;
            const screenX = centerX + Math.cos(p.angle) * p.radiusOffset * scale;
            const screenY = centerY + Math.sin(p.angle) * p.radiusOffset * scale;

            const pAlpha = Math.min(0.8, Math.max(0.15, 1 - (p.z / totalDepth)));
            ctx.globalAlpha = pAlpha;
            ctx.fillRect(screenX - 1.2, screenY - 1.2, 2.4, 2.4);
        });

        ctx.globalAlpha = 1.0;
        animationId = requestAnimationFrame(animate);
    }

    // 3. Eco Mode preference handling
    const lowPerfCheckbox = document.getElementById('low-perf-mode');
    const loginForm = document.getElementById('login-form');
    let isLowPerf = localStorage.getItem('twitch_hub_low_perf') === 'true';

    function applyEcoMode(ecoActive) {
        isLowPerf = ecoActive;
        localStorage.setItem('twitch_hub_low_perf', isLowPerf);

        if (isLowPerf) {
            document.body.classList.add('eco-mode');
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            ctx.clearRect(0, 0, width, height);
        } else {
            document.body.classList.remove('eco-mode');
            if (!animationId) {
                animationId = requestAnimationFrame(animate);
            }
        }
    }

    if (lowPerfCheckbox) {
        lowPerfCheckbox.checked = isLowPerf;
        lowPerfCheckbox.addEventListener('change', (e) => {
            applyEcoMode(e.target.checked);
        });
    }

    // Keep checkbox state synchronized if the form is reset (e.g. during logout)
    if (loginForm && lowPerfCheckbox) {
        loginForm.addEventListener('reset', () => {
            setTimeout(() => {
                lowPerfCheckbox.checked = localStorage.getItem('twitch_hub_low_perf') === 'true';
            }, 0);
        });
    }

    // 4. Initial state configuration on page load
    if (isLowPerf) {
        document.body.classList.add('eco-mode');
        ctx.clearRect(0, 0, width, height);
    } else {
        document.body.classList.remove('eco-mode');
        animationId = requestAnimationFrame(animate);
    }
}