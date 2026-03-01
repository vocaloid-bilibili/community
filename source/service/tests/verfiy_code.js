import node_canvas from "@napi-rs/canvas";

/**
 * 生成验证码图片
 * 
 * @param {string} number 随机整数（000000 - 999999）
 * @returns {Buffer} 图片 PNG 数据
 */
function generate_verify_code_image(number) {
    const colors = [ "red", "pink", "blue", "green", "black", "cyan", "orange" ];
    const styles = [ "normal", "bold", "italic", "underline", "strikethrough" ];
    const fonts = [ "Arial", "Times", "'New Roman'", "'Courier New'", "微软雅黑", "宋体" ];

    const width_px = 120, height_px = 40;

    const canvas = node_canvas
        .createCanvas(width_px, height_px);

    const context = canvas.getContext("2d");

    context.fillStyle = "#f0f0f0";
    context.fillRect(0, 0, width_px, height_px);

    const left_middle = {
        "x": width_px / 8, "y": height_px / 4
    };

    const step_length = width_px * 3 / 26 * 1.1;

    const pick = (array) => {
        const random = Math.random();

        return array[parseInt(
            array.length * random
        )];
    };

    context.textAlign = "center";
    context.textBaseline = "middle";

    const rdm = () => Math.random();

    for (let index = 0; index < 6; index++) {
        context.strokeStyle = `rgb(${rdm() * 255},${rdm() * 255},${rdm() * 255})`;
        context.beginPath();

        context.moveTo(rdm() * width_px, rdm() * height_px);
        context.lineTo(rdm() * width_px, rdm() * height_px);

        context.stroke();
    }

    for (let index = 0; index < 30; index++) {
        context.fillStyle = `rgb(${rdm() * 255},${rdm() * 255},${rdm() * 255})`;
        context.beginPath();
        
        context.arc(rdm() * width_px, rdm() * height_px, 1, 0, Math.PI * 2);
        context.fill();
    }

    const text = number.toString().slice(0, 6).padStart(6, "0");

    for (let index = 0; index < text.length; index++) {
        const char = text[index];

        let { x } = left_middle;

        x += 5 + step_length * index;

        const color = pick(colors);
        const style = pick(styles);
        const font = pick(fonts);

        context.font = `${style} 32px ${font}`;
        context.fillStyle = color;
        
        context.fillText(
            char, x, height_px / 2
        );
    }

    return canvas.toBuffer("image/png");
}