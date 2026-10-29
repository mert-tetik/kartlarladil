package __PACKAGE__;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.view.animation.LinearInterpolator;

/**
 * The native equivalent of the web app's three-dot launch loader. Keeping the
 * indicator in the Android shell lets it render before WebView has a frame.
 */
public final class NativeLoadingIndicatorView extends View {
    private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF shadowBounds = new RectF();
    private ValueAnimator animator;
    private float animationProgress;

    public NativeLoadingIndicatorView(Context context) {
        super(context);
        setContentDescription("Loading");
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        dotPaint.setColor(0xB3FFFFFF);
        shadowPaint.setColor(0x47FFFFFF);
    }

    public void startAnimating() {
        if (animator != null) return;

        animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(1000L);
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setInterpolator(new LinearInterpolator());
        animator.addUpdateListener(valueAnimator -> {
            animationProgress = (float) valueAnimator.getAnimatedValue();
            invalidate();
        });
        animator.start();
    }

    public void stopAnimating() {
        if (animator != null) {
            animator.cancel();
            animator = null;
        }
        animationProgress = 0f;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        float density = getResources().getDisplayMetrics().density;
        float indicatorWidth = 90f * density;
        float left = (getWidth() - indicatorWidth) / 2f;
        // The loader view fills the usable app area. Derive the vertical
        // anchor from that measured height instead of a fixed top offset so
        // the indicator remains centered on every phone and inset layout.
        float restingCenterY = getHeight() / 2f;
        float shadowCenterY = restingCenterY + 5f * density;
        float[] dotCenters = {20f, 45f, 70f};

        for (int index = 0; index < dotCenters.length; index++) {
            float phase = (animationProgress + index * 0.18f) % 1f;
            float bounce = (float) Math.sin(phase * Math.PI);
            float centerX = left + dotCenters[index] * density;
            float centerY = restingCenterY - 27f * density * bounce;
            float radius = (5f + 3f * bounce) * density;

            shadowPaint.setAlpha(Math.round(71f * (1f - 0.35f * bounce)));
            float shadowRadiusX = (5f + 2f * bounce) * density;
            float shadowRadiusY = 3f * density;
            shadowBounds.set(
                    centerX - shadowRadiusX,
                    shadowCenterY - shadowRadiusY,
                    centerX + shadowRadiusX,
                    shadowCenterY + shadowRadiusY
            );
            canvas.drawOval(shadowBounds, shadowPaint);

            dotPaint.setAlpha(179);
            canvas.drawCircle(centerX, centerY, radius, dotPaint);
        }
    }
}
