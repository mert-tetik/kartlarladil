package __PACKAGE__;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;
import android.view.animation.LinearInterpolator;

import java.util.ArrayList;
import java.util.List;

/**
 * The native equivalent of the web app's three-dot launch loader. Keeping the
 * indicator in the Android shell lets it render before WebView has a frame.
 */
public final class NativeLoadingIndicatorView extends View {
    private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint statusPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint progressTrackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint progressFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF shadowBounds = new RectF();
    private final RectF progressBounds = new RectF();
    private final RectF cardBounds = new RectF();
    private final Typeface superWaterTypeface;
    private ValueAnimator animator;
    private float animationProgress;
    private float loadingProgress = 0.08f;
    private String loadingTitle = "WORDS OF THE DAY";
    private String loadingStatus = "Foxies are stretching their tails...";
    private String[] loadingCardTerms = {"learn", "play", "word", "card"};
    private String[] loadingCardTranslations = {"learn", "play", "word", "card"};
    private String[] loadingCardPronunciations = {"learn", "play", "word", "card"};
    private String[] loadingCardExamples = {"", "", "", ""};
    private String[] loadingCardTiers = {"A1", "A2", "B1", "B2"};

    public NativeLoadingIndicatorView(Context context) {
        super(context);
        setContentDescription("Loading");
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        dotPaint.setColor(0xB3FFFFFF);
        shadowPaint.setColor(0x47FFFFFF);
        titlePaint.setColor(Color.parseColor("#fe6507"));
        titlePaint.setTextAlign(Paint.Align.CENTER);
        statusPaint.setColor(0xF2FFFFFF);
        statusPaint.setTextAlign(Paint.Align.CENTER);
        superWaterTypeface = loadSuperWaterTypeface(context);
        statusPaint.setTypeface(superWaterTypeface);
        progressTrackPaint.setColor(0x40FFFFFF);
        progressFillPaint.setColor(0xF2FFFFFF);
        setLoadingState(loadingStatus, 8);
    }

    public void setLoadingState(String status, int progressPercent) {
        loadingStatus = status == null || status.isEmpty() ? "Foxies are stretching their tails..." : status;
        loadingProgress = Math.max(0f, Math.min(1f, progressPercent / 100f));
        setContentDescription(loadingStatus + " " + progressPercent + "%");
        postInvalidateOnAnimation();
    }

    public void setLoadingTitle(String title) {
        loadingTitle = title == null || title.isEmpty() ? "WORDS OF THE DAY" : title;
        postInvalidateOnAnimation();
    }

    public void setLoadingCards(
            String[] terms,
            String[] translations,
            String[] pronunciations,
            String[] examples,
            String[] tiers
    ) {
        if (terms == null || translations == null || pronunciations == null || examples == null || tiers == null) return;

        int count = Math.min(
                4,
                Math.min(
                        Math.min(Math.min(terms.length, translations.length), Math.min(pronunciations.length, examples.length)),
                        tiers.length
                )
        );
        if (count == 0) return;

        loadingCardTerms = new String[count];
        loadingCardTranslations = new String[count];
        loadingCardPronunciations = new String[count];
        loadingCardExamples = new String[count];
        loadingCardTiers = new String[count];
        for (int index = 0; index < count; index++) {
            loadingCardTerms[index] = safeText(terms[index]);
            loadingCardTranslations[index] = safeText(translations[index]);
            loadingCardPronunciations[index] = safeText(pronunciations[index], loadingCardTerms[index]);
            loadingCardExamples[index] = safeText(examples[index]);
            loadingCardTiers[index] = safeTier(tiers[index]);
        }
        postInvalidateOnAnimation();
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
        float centerX = getWidth() / 2f;
        float splitY = getHeight() * 0.62f + 30f * density;
        Paint whitePaint = fillPaint(Color.WHITE);
        Paint orangePaint = fillPaint(Color.parseColor("#fe6507"));
        canvas.drawColor(Color.WHITE);
        canvas.drawRect(0f, 0f, getWidth(), splitY, whitePaint);
        float curveHeight = 40f * density;
        Path orangePanel = new Path();
        // This is the same coordinate map as the visual test SVG:
        // viewBox 0 0 100 20 positioned 40px above the orange panel.
        orangePanel.moveTo(0f, splitY - curveHeight * 0.25f);
        orangePanel.cubicTo(
                getWidth() * 0.25f,
                splitY - curveHeight,
                getWidth() * 0.70f,
                splitY + curveHeight * 0.5f,
                getWidth(),
                splitY - curveHeight * 0.55f
        );
        orangePanel.lineTo(getWidth(), getHeight());
        orangePanel.lineTo(0f, getHeight());
        orangePanel.close();
        canvas.drawPath(orangePanel, orangePaint);

        float cardsMaxWidth = Math.min(300f * density, getWidth() - 48f * density);
        float cardGap = 8f * density;
        float cardAspectHeight = 1.425f;
        float cardScale = 0.94f;
        titlePaint.setTypeface(superWaterTypeface);
        titlePaint.setTextSize(32f * density);
        Paint.FontMetrics titleMetrics = titlePaint.getFontMetrics();
        float titleTop = 8f * density;
        float titleBaseline = titleTop - titleMetrics.ascent;
        Rect titleBounds = new Rect();
        titlePaint.getTextBounds(loadingTitle, 0, loadingTitle.length(), titleBounds);
        float titleBottom = titleBaseline + titleBounds.bottom;
        float titleCardGap = 10f;
        float cardsBottomGap = 12f * density;
        float cardsAvailableHeight = Math.max(
                0f,
                splitY - titleBottom - titleCardGap - cardsBottomGap
        );
        float widthLimitedCardWidth = (cardsMaxWidth - cardGap) / 2f;
        float widthLimitedCardHeight = widthLimitedCardWidth * cardAspectHeight;
        float heightLimitedCardHeight = Math.max(0f, (cardsAvailableHeight - cardGap) / 2f);
        float cardCellHeight = Math.min(widthLimitedCardHeight, heightLimitedCardHeight);
        float cardCellWidth = cardCellHeight / cardAspectHeight;
        float cardHeight = cardCellHeight * cardScale;
        float cardWidth = cardCellWidth * cardScale;
        float cardsWidth = cardCellWidth * 2f + cardGap;
        float cardsLeft = (getWidth() - cardsWidth) / 2f;
        float cardsGridHeight = cardCellHeight * 2f + cardGap;
        float titleGroupHeight = (titleBottom - titleTop) + titleCardGap + cardsGridHeight;
        float centeredTitleTop = Math.max(0f, (splitY - titleGroupHeight) / 2f);
        float titleShift = centeredTitleTop - titleTop;
        titleBaseline += titleShift;
        titleBottom += titleShift;
        float cardsTop = titleBottom + titleCardGap - (4f * cardHeight / 570f);
        drawFittedText(
                canvas,
                loadingTitle,
                centerX,
                titleBaseline,
                titlePaint,
                getWidth() - 48f * density
        );
        for (int index = 0; index < loadingCardTerms.length && index < 4; index++) {
            int row = index / 2;
            int column = index % 2;
            float cellLeft = cardsLeft + column * (cardCellWidth + cardGap);
            float cardLeft = cellLeft + (cardCellWidth - cardWidth) / 2f;
            float cardTop = cardsTop + row * (cardCellHeight + cardGap);
            cardBounds.set(cardLeft, cardTop, cardLeft + cardWidth, cardTop + cardHeight);
            drawLoadingCard(
                    canvas,
                    cardBounds,
                    loadingCardTerms[index],
                    loadingCardTranslations[index],
                    loadingCardPronunciations[index],
                    loadingCardExamples[index],
                    loadingCardTiers[index]
            );
        }

        float lowerCenterY = splitY + (getHeight() - splitY) / 2f - 4f * density;
        float indicatorWidth = 72f * density;
        float left = (getWidth() - indicatorWidth) / 2f;
        float[] dotCenters = {12f, 36f, 60f};
        float indicatorLift = 4f * density;
        float shadowCenterY = lowerCenterY - 43f * density - indicatorLift;
        float progressWidth = Math.min(220f * density, getWidth() - 96f * density);
        float progressHeight = 16f * density;
        float progressTop = lowerCenterY + 28f * density;
        float progressLeft = (getWidth() - progressWidth) / 2f;
        statusPaint.setColor(0xF2FFFFFF);
        statusPaint.setTextSize(22f * density);
        drawFittedText(
                canvas,
                loadingStatus,
                centerX,
                progressTop - 10f * density,
                statusPaint,
                getWidth() - 48f * density
        );

        progressBounds.set(
                progressLeft,
                progressTop,
                progressLeft + progressWidth,
                progressTop + progressHeight
        );
        progressTrackPaint.setColor(0x40FFFFFF);
        progressFillPaint.setColor(0xF2FFFFFF);
        canvas.drawRoundRect(progressBounds, progressHeight / 2f, progressHeight / 2f, progressTrackPaint);
        progressBounds.right = progressLeft + progressWidth * loadingProgress;
        canvas.drawRoundRect(progressBounds, progressHeight / 2f, progressHeight / 2f, progressFillPaint);

        for (int index = 0; index < dotCenters.length; index++) {
            float phase = (animationProgress + index * 0.18f) % 1f;
            float bounce = (float) Math.sin(phase * Math.PI);
            float dotCenterX = left + dotCenters[index] * density;
            float centerY = lowerCenterY - 48f * density - indicatorLift - 24f * density * bounce;
            float radius = (4f + 2f * bounce) * density;

            shadowPaint.setAlpha(Math.round(71f * (1f - 0.35f * bounce)));
            float shadowRadiusX = (5f + 2f * bounce) * density;
            float shadowRadiusY = 3f * density;
            shadowBounds.set(
                    dotCenterX - shadowRadiusX,
                    shadowCenterY - shadowRadiusY,
                    dotCenterX + shadowRadiusX,
                    shadowCenterY + shadowRadiusY
            );
            canvas.drawOval(shadowBounds, shadowPaint);

            dotPaint.setAlpha(179);
            canvas.drawCircle(dotCenterX, centerY, radius, dotPaint);
        }
    }

    private void drawLoadingCard(
            Canvas canvas,
            RectF bounds,
            String term,
            String translation,
            String pronunciation,
            String example,
            String tier
    ) {
        float scaleX = bounds.width() / 400f;
        float scaleY = bounds.height() / 570f;
        canvas.save();
        canvas.translate(bounds.left, bounds.top);
        canvas.scale(scaleX, scaleY);

        int tierColor = tierColor(tier);
        Paint shellPaint = gradientPaint(tierColor, mixWithWhite(tierColor, 0.18f), tierColor);
        Paint insetPaint = gradientPaint(mixWithWhite(tierColor, 0.05f), mixWithBlack(tierColor, 0.12f), mixWithWhite(tierColor, 0.18f));
        Paint paperPaint = gradientPaint(Color.parseColor("#fff9e9"), Color.parseColor("#fff4de"), Color.parseColor("#fff0d3"));
        Paint outlinePaint = strokePaint(mixWithWhite(tierColor, 0.03f), 3f);
        Paint paleOutlinePaint = strokePaint(Color.parseColor("#f7ffff"), 4f);
        Paint badgePaint = fillPaint(tierColor);
        Paint termPaint = textPaint(Color.parseColor("#102d49"), Typeface.create("sans-serif", Typeface.BOLD), 50f);
        Paint translationPaint = textPaint(Color.parseColor("#173653"), Typeface.create("sans-serif", Typeface.BOLD), 31f);
        Paint pronunciationPaint = textPaint(Color.WHITE, Typeface.create("sans-serif", Typeface.BOLD), 21f);
        Paint examplePaint = textPaint(Color.parseColor("#173653"), Typeface.create("sans-serif", Typeface.BOLD), 24f);
        examplePaint.setTextAlign(Paint.Align.CENTER);
        Paint labelPaint = fillPaint(mixWithBlack(tierColor, 0.12f));

        canvas.drawRoundRect(new RectF(4f, 4f, 396f, 566f), 38f, 38f, shellPaint);
        canvas.drawRoundRect(new RectF(4f, 4f, 396f, 566f), 38f, 38f, outlinePaint);
        canvas.drawRoundRect(new RectF(15f, 11f, 385f, 559f), 32f, 32f, insetPaint);
        canvas.drawRoundRect(new RectF(15f, 11f, 385f, 559f), 32f, 32f, paleOutlinePaint);

        Path paper = new Path();
        paper.moveTo(39f, 55f);
        paper.cubicTo(82f, 43f, 124f, 50f, 164f, 50f);
        paper.cubicTo(222f, 52f, 276f, 40f, 326f, 45f);
        paper.cubicTo(344f, 47f, 357f, 51f, 365f, 57f);
        paper.lineTo(364f, 462f);
        paper.cubicTo(364f, 479f, 352f, 487f, 335f, 487f);
        paper.cubicTo(290f, 498f, 245f, 507f, 200f, 507f);
        paper.cubicTo(144f, 507f, 99f, 497f, 53f, 485f);
        paper.cubicTo(37f, 481f, 29f, 473f, 29f, 457f);
        paper.lineTo(28f, 75f);
        paper.cubicTo(28f, 66f, 31f, 59f, 39f, 55f);
        paper.close();
        canvas.drawPath(paper, paperPaint);

        float badgeRadius = 42.5f;
        Paint badgeOutline = strokePaint(Color.parseColor("#e7ffff"), 3.75f);
        canvas.drawCircle(24f + badgeRadius, 23f + badgeRadius, badgeRadius, badgePaint);
        canvas.drawCircle(24f + badgeRadius, 23f + badgeRadius, badgeRadius, badgeOutline);
        Paint tierPaint = textPaint(Color.WHITE, superWaterTypeface, 35f);
        tierPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(tier, 24f + badgeRadius, 23f + badgeRadius + 12f, tierPaint);

        termPaint.setTextAlign(Paint.Align.CENTER);
        translationPaint.setTextAlign(Paint.Align.CENTER);
        pronunciationPaint.setTextAlign(Paint.Align.CENTER);
        drawFittedText(canvas, term, 200f, 151f, termPaint, 270f);
        drawFittedText(canvas, translation, 200f, 220f, translationPaint, 270f);

        canvas.drawRoundRect(new RectF(108f, 279f, 292f, 322f), 22f, 22f, labelPaint);
        drawFittedText(canvas, pronunciation, 200f, 307f, pronunciationPaint, 160f);

        Paint dividerPaint = strokePaint(Color.parseColor("#b6a984"), 1.25f);
        canvas.drawLine(64f, 342f, 336f, 342f, dividerPaint);
        int visibleExampleLines = drawExampleText(canvas, example, 200f, 360f, examplePaint, 272f);
        if (visibleExampleLines < 3) {
            drawCardFoxMark(canvas);
        }
        canvas.restore();
    }

    private int drawExampleText(
            Canvas canvas,
            String example,
            float centerX,
            float top,
            Paint paint,
            float maxWidth
    ) {
        if (example == null || example.trim().isEmpty()) return 0;

        List<String> lines = new ArrayList<>();
        for (String paragraph : example.trim().split("\\r?\\n")) {
            String remaining = paragraph.trim();
            while (!remaining.isEmpty()) {
                int characterCount = paint.breakText(remaining, true, maxWidth, null);
                if (characterCount <= 0) break;
                int end = characterCount;
                if (end < remaining.length()) {
                    int lastSpace = remaining.lastIndexOf(' ', end - 1);
                    if (lastSpace > 0) end = lastSpace;
                }
                String line = remaining.substring(0, end).trim();
                if (line.isEmpty()) break;
                lines.add(line);
                remaining = remaining.substring(end).trim();
            }
        }

        if (lines.isEmpty()) return 0;
        if (lines.size() > 3) {
            lines = new ArrayList<>(lines.subList(0, 3));
            String last = lines.get(2);
            while (last.length() > 1 && paint.measureText(last + "…") > maxWidth) {
                last = last.substring(0, last.length() - 1).trim();
            }
            lines.set(2, last + "…");
        }

        float lineHeight = paint.getTextSize() * 1.35f;
        float baseline = top - paint.ascent();
        for (String line : lines) {
            canvas.drawText(line, centerX, baseline, paint);
            baseline += lineHeight;
        }
        return lines.size();
    }

    private void drawCardFoxMark(Canvas canvas) {
        Path outline = new Path();
        outline.moveTo(10f, 22f);
        outline.lineTo(13f, 5f);
        outline.lineTo(31f, 17f);
        outline.cubicTo(35f, 15.5f, 41f, 15.5f, 45f, 17f);
        outline.lineTo(63f, 5f);
        outline.lineTo(66f, 22f);
        outline.cubicTo(67f, 36f, 60f, 48f, 46f, 53f);
        outline.cubicTo(41f, 55f, 35f, 55f, 30f, 53f);
        outline.cubicTo(17f, 48f, 9f, 36f, 10f, 22f);
        outline.close();

        Path face = new Path();
        face.moveTo(27f, 34f);
        face.lineTo(27.1f, 34f);
        face.moveTo(49f, 34f);
        face.lineTo(49.1f, 34f);
        face.moveTo(35f, 40f);
        face.cubicTo(38f, 43f, 40f, 43f, 43f, 40f);

        canvas.save();
        canvas.translate(160f, 422f);
        canvas.scale(80f / 76f, 62f / 58f);

        Paint outlineShadow = strokePaint(Color.parseColor("#b29a70"), 4f);
        outlineShadow.setStrokeCap(Paint.Cap.ROUND);
        outlineShadow.setStrokeJoin(Paint.Join.ROUND);
        canvas.save();
        canvas.translate(0f, -1f);
        canvas.drawPath(outline, outlineShadow);
        canvas.restore();

        Paint outlineHighlight = strokePaint(Color.parseColor("#fff7e4"), 2.4f);
        outlineHighlight.setStrokeCap(Paint.Cap.ROUND);
        outlineHighlight.setStrokeJoin(Paint.Join.ROUND);
        canvas.save();
        canvas.translate(0f, 1f);
        canvas.drawPath(outline, outlineHighlight);
        canvas.restore();

        Paint faceShadow = strokePaint(Color.parseColor("#a88f65"), 2.7f);
        faceShadow.setStrokeCap(Paint.Cap.ROUND);
        canvas.save();
        canvas.translate(0f, -0.8f);
        canvas.drawPath(face, faceShadow);
        canvas.restore();

        Paint faceHighlight = strokePaint(Color.parseColor("#fff8e9"), 1.3f);
        faceHighlight.setStrokeCap(Paint.Cap.ROUND);
        canvas.save();
        canvas.translate(0f, 0.8f);
        canvas.drawPath(face, faceHighlight);
        canvas.restore();
        canvas.restore();
    }

    private void drawFittedText(Canvas canvas, String text, float centerX, float baseline, Paint paint, float maxWidth) {
        if (text == null || text.isEmpty()) return;
        String fitted = text;
        if (paint.measureText(fitted) > maxWidth) {
            int characterCount = paint.breakText(fitted, true, maxWidth, null);
            if (characterCount <= 0) return;
            fitted = fitted.substring(0, Math.max(1, characterCount - 1)) + "…";
        }
        canvas.drawText(fitted, centerX, baseline, paint);
    }

    private static Paint fillPaint(int color) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        return paint;
    }

    private static Paint textPaint(int color, Typeface typeface, float size) {
        Paint paint = fillPaint(color);
        paint.setTypeface(typeface);
        paint.setTextSize(size);
        return paint;
    }

    private static Paint gradientPaint(int start, int middle, int end) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(0f, 0f, 400f, 570f, new int[]{start, middle, end}, null, Shader.TileMode.CLAMP));
        return paint;
    }

    private static Paint strokePaint(int color, float width) {
        Paint paint = fillPaint(color);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(width);
        return paint;
    }

    private static int tierColor(String tier) {
        if ("A2".equals(tier)) return Color.parseColor("#36b9ca");
        if ("B1".equals(tier)) return Color.parseColor("#b163ff");
        if ("B2".equals(tier)) return Color.parseColor("#ffae00");
        if ("C1".equals(tier)) return Color.parseColor("#fa5252");
        return Color.parseColor("#52bf70");
    }

    private static int mixWithWhite(int color, float amount) {
        return Color.rgb(
                Math.round(Color.red(color) + (255 - Color.red(color)) * amount),
                Math.round(Color.green(color) + (255 - Color.green(color)) * amount),
                Math.round(Color.blue(color) + (255 - Color.blue(color)) * amount)
        );
    }

    private static int mixWithBlack(int color, float amount) {
        return Color.rgb(
                Math.round(Color.red(color) * (1f - amount)),
                Math.round(Color.green(color) * (1f - amount)),
                Math.round(Color.blue(color) * (1f - amount))
        );
    }

    private static String safeText(String value) {
        return safeText(value, "");
    }

    private static String safeText(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }

    private static String safeTier(String value) {
        return "A2".equals(value) || "B1".equals(value) || "B2".equals(value) || "C1".equals(value)
                ? value
                : "A1";
    }

    private static Typeface loadSuperWaterTypeface(Context context) {
        try {
            return Typeface.createFromAsset(context.getAssets(), "foxiesdeck-offline/super-water.ttf");
        } catch (RuntimeException ignored) {
            return Typeface.create("sans-serif-rounded", Typeface.BOLD);
        }
    }

}
