import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04101c, 0.017);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(0, 11, 23);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0x89b8ff, 0.7);
scene.add(ambient);

const key = new THREE.DirectionalLight(0x67ecff, 0.95);
key.position.set(8, 14, 6);
scene.add(key);

const fill = new THREE.PointLight(0xffb969, 0.9, 60);
fill.position.set(-9, 8, -6);
scene.add(fill);

const junction = new THREE.Group();
scene.add(junction);

const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1e2936,
    roughness: 0.87,
    metalness: 0.1
});

const laneLineMat = new THREE.MeshStandardMaterial({
    color: 0xdce6f5,
    emissive: 0x22334d,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.08
});

const roadH = new THREE.Mesh(new THREE.BoxGeometry(84, 0.7, 7), roadMat);
const roadV = new THREE.Mesh(new THREE.BoxGeometry(7, 0.7, 84), roadMat);
junction.add(roadH, roadV);

function addLaneMarks(horizontal = true) {
    const markGeom = new THREE.BoxGeometry(horizontal ? 1.6 : 0.17, 0.03, horizontal ? 0.17 : 1.6);
    for (let i = -36; i <= 36; i += 3) {
        if (Math.abs(i) < 2) continue;
        const mark = new THREE.Mesh(markGeom, laneLineMat);
        if (horizontal) {
            mark.position.set(i, 0.38, 0);
        } else {
            mark.position.set(0, 0.38, i);
        }
        junction.add(mark);
    }
}

addLaneMarks(true);
addLaneMarks(false);

const island = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x243848, roughness: 0.82 })
);
island.position.y = 0.52;
junction.add(island);

const poles = new THREE.Group();
const signalHeads = [];

function makeSignalPole(x, z, rotationY) {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(x, 0, z);
    poleGroup.rotation.y = rotationY;

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 4.3, 10),
        new THREE.MeshStandardMaterial({ color: 0x6f7e8d, metalness: 0.48, roughness: 0.36 })
    );
    pole.position.y = 2.2;
    poleGroup.add(pole);

    const headBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 1.8, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x111720, metalness: 0.18, roughness: 0.62 })
    );
    headBody.position.set(0, 3.4, 0.62);
    poleGroup.add(headBody);

    const bulbY = [3.95, 3.4, 2.86];
    const bulbs = [];
    for (const y of bulbY) {
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 14, 14),
            new THREE.MeshStandardMaterial({
                color: 0x222831,
                emissive: 0x000000,
                emissiveIntensity: 0
            })
        );
        bulb.position.set(0, y, 0.92);
        bulbs.push(bulb);
        poleGroup.add(bulb);
    }

    poles.add(poleGroup);
    signalHeads.push(bulbs);
}

makeSignalPole(3.8, -9.4, 0);
makeSignalPole(-3.8, 9.4, Math.PI);
makeSignalPole(-9.4, -3.8, Math.PI * 0.5);
makeSignalPole(9.4, 3.8, -Math.PI * 0.5);
scene.add(poles);

const vehicles = [];
const carPalette = [0x46d6ff, 0xffb347, 0x57e3a1, 0xc2d4ff, 0xff6f7f, 0x5b7dff];
const motoPalette = [0x3bd8b0, 0xff9f5a, 0x84a6ff, 0xff668e];

function buildCarModel(color) {
    const car = new THREE.Group();

    const bodyPaint = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.42,
        roughness: 0.33,
        emissive: color,
        emissiveIntensity: 0.045
    });

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x10161f, metalness: 0.2, roughness: 0.62 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x7ea3c9, metalness: 0.08, roughness: 0.12 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.36, 2.38), bodyPaint);
    chassis.position.y = 0.2;
    car.add(chassis);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.32, 1.34), bodyPaint);
    roof.position.set(0, 0.54, -0.06);
    car.add(roof);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.23, 0.52), glassMat);
    windshield.position.set(0, 0.56, 0.52);
    car.add(windshield);

    const backGlass = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.22, 0.4), glassMat);
    backGlass.position.set(0, 0.56, -0.62);
    car.add(backGlass);

    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 0.2), trimMat);
    bumperFront.position.set(0, 0.14, 1.18);
    car.add(bumperFront);

    const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 0.2), trimMat);
    bumperRear.position.set(0, 0.14, -1.18);
    car.add(bumperRear);

    const headLightMat = new THREE.MeshStandardMaterial({
        color: 0xeaf8ff,
        emissive: 0x95d8ff,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0
    });

    const tailLightMat = new THREE.MeshStandardMaterial({
        color: 0xff8b8b,
        emissive: 0xff4040,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0
    });

    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), headLightMat);
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), headLightMat);
    headL.position.set(-0.34, 0.26, 1.22);
    headR.position.set(0.34, 0.26, 1.22);
    car.add(headL, headR);

    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), tailLightMat);
    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), tailLightMat);
    tailL.position.set(-0.34, 0.26, -1.22);
    tailR.position.set(0.34, 0.26, -1.22);
    car.add(tailL, tailR);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0e14, metalness: 0.15, roughness: 0.75 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x90a4bb, metalness: 0.55, roughness: 0.28 });

    const wheelPositions = [
        [-0.54, 0.02, 0.8],
        [0.54, 0.02, 0.8],
        [-0.54, 0.02, -0.82],
        [0.54, 0.02, -0.82]
    ];

    const wheels = [];
    for (const [x, y, z] of wheelPositions) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 18), wheelMat);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.position.set(x, y, z);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.205, 16), rimMat);
        rim.rotation.z = Math.PI * 0.5;
        rim.position.set(x, y, z);

        car.add(wheel, rim);
        wheels.push(wheel, rim);
    }

    return { mesh: car, wheels, length: 2.5 };
}

function buildMotorcycleModel(color) {
    const bike = new THREE.Group();

    const frameMat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c1016, metalness: 0.18, roughness: 0.7 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x98a8b8, metalness: 0.72, roughness: 0.22 });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 1.25), frameMat);
    frame.position.y = 0.28;
    bike.add(frame);

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.55), blackMat);
    seat.position.set(0, 0.45, -0.08);
    bike.add(seat);

    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.28), frameMat);
    tank.position.set(0, 0.45, 0.18);
    bike.add(tank);

    const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), chromeMat);
    handleBar.position.set(0, 0.52, 0.45);
    bike.add(handleBar);

    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.05), chromeMat);
    fork.position.set(0, 0.26, 0.49);
    bike.add(fork);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x090d12, roughness: 0.8, metalness: 0.1 });
    const frontWheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 24), wheelMat);
    frontWheel.position.set(0, 0.13, 0.55);
    frontWheel.rotation.y = Math.PI * 0.5;
    bike.add(frontWheel);

    const rearWheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 12, 24), wheelMat);
    rearWheel.position.set(0, 0.13, -0.53);
    rearWheel.rotation.y = Math.PI * 0.5;
    bike.add(rearWheel);

    const headLamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8f6ff, emissive: 0x8ad8ff, emissiveIntensity: 0.8 })
    );
    headLamp.position.set(0, 0.42, 0.66);
    bike.add(headLamp);

    return { mesh: bike, wheels: [frontWheel, rearWheel], length: 1.6 };
}

function createVehicle(kind, pathType, direction, lane, offset, speed, color) {
    const built = kind === 'motorcycle' ? buildMotorcycleModel(color) : buildCarModel(color);
    scene.add(built.mesh);
    vehicles.push({
        kind,
        mesh: built.mesh,
        wheels: built.wheels,
        length: built.length,
        pathType,
        direction,
        lane,
        offset,
        speed,
        nextOffset: offset
    });
}

for (let i = 0; i < 12; i += 1) {
    const pathType = i % 2 === 0 ? 'h' : 'v';
    const direction = i % 4 < 2 ? 1 : -1;
    const lane = i % 3 === 0 ? -1.1 : 1.1;
    const speed = 0.042 + Math.random() * 0.034;
    const offset = Math.random() * 66 - 33;
    createVehicle('car', pathType, direction, lane, offset, speed, carPalette[i % carPalette.length]);
}

for (let i = 0; i < 6; i += 1) {
    const pathType = i % 2 === 0 ? 'h' : 'v';
    const direction = i % 3 === 0 ? -1 : 1;
    const lane = i % 2 === 0 ? -2.25 : 2.25;
    const speed = 0.055 + Math.random() * 0.03;
    const offset = Math.random() * 66 - 33;
    createVehicle('motorcycle', pathType, direction, lane, offset, speed, motoPalette[i % motoPalette.length]);
}

const cycle = {
    index: 0,
    elapsed: 0,
    duration: 2.8
};

const states = [
    { h: 'green', v: 'red' },
    { h: 'yellow', v: 'red' },
    { h: 'red', v: 'green' },
    { h: 'red', v: 'yellow' }
];

function setBulbState(bulbs, colorName) {
    bulbs[0].material.emissive.setHex(colorName === 'red' ? 0xff3d3d : 0x000000);
    bulbs[0].material.color.setHex(colorName === 'red' ? 0xff5a5a : 0x222831);
    bulbs[0].material.emissiveIntensity = colorName === 'red' ? 1.2 : 0;

    bulbs[1].material.emissive.setHex(colorName === 'yellow' ? 0xffb347 : 0x000000);
    bulbs[1].material.color.setHex(colorName === 'yellow' ? 0xffc466 : 0x222831);
    bulbs[1].material.emissiveIntensity = colorName === 'yellow' ? 1.2 : 0;

    bulbs[2].material.emissive.setHex(colorName === 'green' ? 0x55ef9d : 0x000000);
    bulbs[2].material.color.setHex(colorName === 'green' ? 0x7cf5b2 : 0x222831);
    bulbs[2].material.emissiveIntensity = colorName === 'green' ? 1.2 : 0;
}

function updateSignals(dt) {
    cycle.elapsed += dt;
    if (cycle.elapsed >= cycle.duration) {
        cycle.elapsed = 0;
        cycle.index = (cycle.index + 1) % states.length;
    }

    const state = states[cycle.index];
    signalHeads.forEach((bulbs, i) => {
        const isHorizontal = i < 2;
        setBulbState(bulbs, isHorizontal ? state.h : state.v);
    });
}

function signalAllows(pathType) {
    const state = states[cycle.index];
    return pathType === 'h' ? state.h === 'green' : state.v === 'green';
}

function updateCars() {
    const roadLimit = 38;
    const intersectionEdge = 3.5;

    for (const vehicle of vehicles) {
        let nextOffset = vehicle.offset + vehicle.speed * vehicle.direction;

        if (nextOffset > roadLimit) nextOffset = -roadLimit;
        if (nextOffset < -roadLimit) nextOffset = roadLimit;

        if (!signalAllows(vehicle.pathType)) {
            const stopBuffer = vehicle.length * 0.5 + 0.7;
            const stopLine = vehicle.direction > 0
                ? -(intersectionEdge + stopBuffer)
                : (intersectionEdge + stopBuffer);

            if (vehicle.direction > 0 && vehicle.offset < stopLine && nextOffset > stopLine) {
                nextOffset = stopLine;
            }
            if (vehicle.direction < 0 && vehicle.offset > stopLine && nextOffset < stopLine) {
                nextOffset = stopLine;
            }
        }

        vehicle.nextOffset = nextOffset;
    }

    const laneGroups = new Map();
    for (const vehicle of vehicles) {
        const key = `${vehicle.pathType}_${vehicle.direction}_${vehicle.lane}`;
        if (!laneGroups.has(key)) laneGroups.set(key, []);
        laneGroups.get(key).push(vehicle);
    }

    laneGroups.forEach(group => {
        group.sort((a, b) => (a.direction > 0 ? b.nextOffset - a.nextOffset : a.nextOffset - b.nextOffset));
        for (let i = 1; i < group.length; i += 1) {
            const lead = group[i - 1];
            const follow = group[i];
            const minGap = lead.length * 0.62 + follow.length * 0.62 + (follow.kind === 'motorcycle' ? 0.35 : 0.55);

            if (follow.direction > 0) {
                const maxOffset = lead.nextOffset - minGap;
                follow.nextOffset = Math.min(follow.nextOffset, maxOffset);
            } else {
                const minOffset = lead.nextOffset + minGap;
                follow.nextOffset = Math.max(follow.nextOffset, minOffset);
            }
        }
    });

    for (const vehicle of vehicles) {
        const movement = vehicle.nextOffset - vehicle.offset;
        vehicle.offset = vehicle.nextOffset;

        const yBase = vehicle.kind === 'motorcycle' ? 0.63 : 0.7;

        if (vehicle.pathType === 'h') {
            vehicle.mesh.position.set(vehicle.offset, yBase, vehicle.lane);
            vehicle.mesh.rotation.y = vehicle.direction > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        } else {
            vehicle.mesh.position.set(vehicle.lane, yBase, vehicle.offset);
            vehicle.mesh.rotation.y = vehicle.direction > 0 ? 0 : Math.PI;
        }

        for (const wheel of vehicle.wheels) {
            wheel.rotation.x -= movement * 1.05;
        }
    }
}

const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (event) => {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (event.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);

    updateSignals(dt);
    updateCars();

    camera.position.x += (mouse.x * 3.2 - camera.position.x) * 0.04;
    camera.position.y += (10.5 + mouse.y * 1.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0.45, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();
