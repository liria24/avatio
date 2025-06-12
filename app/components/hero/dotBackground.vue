<script setup lang="ts">
const canvas = ref<HTMLCanvasElement | null>(null)
const dotSize = 1
const gap = 28
const gradientRadius = 160

const drawDots = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    mouseX: number,
    mouseY: number
) => {
    ctx.clearRect(0, 0, width, height)
    for (let y = 0; y < height; y += gap)
        for (let x = 0; x < width; x += gap) {
            const distance = Math.hypot(x - mouseX, y - mouseY)
            const alpha =
                distance < gradientRadius ? 1 - distance / gradientRadius : 0
            ctx.fillStyle = `rgba(100,100,100,${alpha})`
            ctx.beginPath()
            ctx.arc(x, y, dotSize, 0, Math.PI * 2)
            ctx.fill()
        }
}

const { x: pointerX, y: pointerY } = usePointer()

onMounted(() => {
    if (!canvas.value) return
    const context = canvas.value.getContext('2d')
    if (!context) return

    const resizeCanvas = () => {
        if (!canvas.value) return
        canvas.value.width = canvas.value.offsetWidth
        canvas.value.height = canvas.value.offsetHeight
        drawDots(context, canvas.value.width, canvas.value.height, -1000, -1000)
    }

    window.addEventListener('resize', resizeCanvas)
    resizeCanvas()

    onUnmounted(() => {
        window.removeEventListener('resize', resizeCanvas)
    })

    watch(
        [pointerX, pointerY],
        ([newX, newY]) => {
            if (!canvas.value) return
            const { left, top } = canvas.value.getBoundingClientRect()
            drawDots(
                context,
                canvas.value.width,
                canvas.value.height,
                newX - left,
                newY - top
            )
        },
        { immediate: true }
    )
})
</script>

<template>
    <canvas ref="canvas" class="dot-background" />
</template>

<style scoped>
.dot-background {
    z-index: -1;
    pointer-events: none;
}
</style>
