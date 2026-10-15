// Pointer → building (P1-06). Building bodies are one InstancedMesh in `placed` order.

// Pointer travel (px) between down and up; more than this is a camera drag, not a click.
export const CLICK_TOLERANCE = 4;

export const isClick = (delta) => delta <= CLICK_TOLERANCE;

/** Slug of the instance hit by a pointer event, or null. */
export const slugAt = (placed, instanceId) => (Number.isInteger(instanceId) ? placed[instanceId]?.slug ?? null : null);

/** Hover only follows a mouse or pen; on touch a tap is a click. */
export const canHover = (pointerType) => pointerType === 'mouse' || pointerType === 'pen';
