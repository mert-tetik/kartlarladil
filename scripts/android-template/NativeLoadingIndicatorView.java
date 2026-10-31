package __PACKAGE__;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;
import android.view.animation.LinearInterpolator;

import java.util.ArrayList;
import java.util.List;

/**
 * The launch loader is drawn before the remote WebView exists. Its card face
 * mirrors the offline card renderer's 400x570 SVG geometry so the first frame
 * does not need a network request or a second WebView.
 */
public final class NativeLoadingIndicatorView extends View {
    private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint titlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint statusPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF progressBounds = new RectF();
    private final RectF shadowBounds = new RectF();
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
        titlePaint.setTypeface(superWaterTypeface);
        statusPaint.setTypeface(superWaterTypeface);
    }

    public void setLoadingState(String status, int progressPercent) {
        loadingStatus = safeText(status, "Foxies are stretching their tails...");
        loadingProgress = Math.max(0f, Math.min(1f, progressPercent / 100f));
        setContentDescription(loadingStatus + " " + progressPercent + "%");
        postInvalidateOnAnimation();
    }

    public void setLoadingTitle(String title) {
        loadingTitle = safeText(title, "WORDS OF THE DAY");
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
            loadingCardTranslations[index] = safeText(translations[index], loadingCardTerms[index]);
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

        Path orangePanel = new Path();
        float curveHeight = 40f * density;
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

        float titleSize = 32f * density;
        titlePaint.setTextSize(titleSize);
        titlePaint.setTypeface(superWaterTypeface);
        Paint.FontMetrics titleMetrics = titlePaint.getFontMetrics();
        float titleHeight = titleMetrics.descent - titleMetrics.ascent;
        float cardsTop = 0f;
        float cardsWidth = Math.min(300f * density, getWidth() - 48f * density);
        float cardGap = 8f * density;
        float cardAspectHeight = 570f / 400f;
        float widthLimitedCardHeight = ((cardsWidth - cardGap) / 2f) * cardAspectHeight;
        float topPadding = 12f * density;
        float availableCardHeight = Math.max(0f, splitY - topPadding - titleHeight - 10f * density - 12f * density);
        float cardCellHeight = Math.min(widthLimitedCardHeight, Math.max(0f, (availableCardHeight - cardGap) / 2f));
        float cardCellWidth = cardCellHeight / cardAspectHeight;
        if (cardCellHeight <= 0f) {
            cardCellWidth = (cardsWidth - cardGap) / 2f;
            cardCellHeight = cardCellWidth * cardAspectHeight;
        }
        float cardScale = 0.94f;
        float cardWidth = cardCellWidth * cardScale;
        float cardHeight = cardCellHeight * cardScale;
        float gridWidth = cardCellWidth * 2f + cardGap;
        float gridHeight = cardCellHeight * 2f + cardGap;
        float groupHeight = titleHeight + 10f * density + gridHeight;
        float groupTop = Math.max(topPadding, (splitY - groupHeight) / 2f);
        float titleBaseline = groupTop - titleMetrics.ascent;
        cardsTop = groupTop + titleHeight + 10f * density;
        drawFittedText(canvas, loadingTitle, centerX, titleBaseline, titlePaint, getWidth() - 48f * density);

        float cardsLeft = (getWidth() - gridWidth) / 2f;
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
        for (int index = 0; index < dotCenters.length; index++) {
            float phase = (animationProgress + index * 0.18f) % 1f;
            float bounce = (float) Math.sin(phase * Math.PI);
            float dotCenterX = left + dotCenters[index] * density;
            float centerY = lowerCenterY - 48f * density - indicatorLift - 24f * density * bounce;
            float radius = (4f + 2f * bounce) * density;

            shadowPaint.setAlpha(Math.round(71f * (1f - 0.35f * bounce)));
            float shadowRadiusX = (5f + 2f * bounce) * density;
            shadowBounds.set(
                    dotCenterX - shadowRadiusX,
                    shadowCenterY - 3f * density,
                    dotCenterX + shadowRadiusX,
                    shadowCenterY + 3f * density
            );
            canvas.drawOval(shadowBounds, shadowPaint);
            dotPaint.setAlpha(179);
            canvas.drawCircle(dotCenterX, centerY, radius, dotPaint);
        }

        statusPaint.setTypeface(superWaterTypeface);
        statusPaint.setTextSize(22f * density);
        Paint.FontMetrics statusMetrics = statusPaint.getFontMetrics();
        float statusBaseline = lowerCenterY + 28f * density - 10f * density;
        drawFittedText(canvas, loadingStatus, centerX, statusBaseline, statusPaint, getWidth() - 48f * density);

        float progressWidth = Math.min(220f * density, getWidth() - 96f * density);
        float progressHeight = 16f * density;
        float progressTop = lowerCenterY + 28f * density;
        float progressLeft = (getWidth() - progressWidth) / 2f;
        progressBounds.set(progressLeft, progressTop, progressLeft + progressWidth, progressTop + progressHeight);
        Paint progressTrack = fillPaint(0x40FFFFFF);
        Paint progressFill = fillPaint(0xF2FFFFFF);
        canvas.drawRoundRect(progressBounds, progressHeight / 2f, progressHeight / 2f, progressTrack);
        progressBounds.right = progressLeft + progressWidth * loadingProgress;
        canvas.drawRoundRect(progressBounds, progressHeight / 2f, progressHeight / 2f, progressFill);
    }

    private void drawLoadingCard(Canvas canvas, RectF bounds, String term, String translation, String pronunciation, String example, String tier) {
        float scaleX = bounds.width() / 400f;
        float scaleY = bounds.height() / 570f;
        canvas.save();
        canvas.translate(bounds.left, bounds.top);
        canvas.scale(scaleX, scaleY);

        int tierColor = tierColor(tier);
        Palette palette = palette(tierColor, tier);
        Paint shell = gradientPaint(palette.shellPrimary, palette.shellHighlight, palette.shellEnd);
        Paint inset = gradientPaint(palette.insetPrimary, palette.insetMiddle, palette.insetEnd);
        Paint paper = gradientPaint(Color.parseColor("#fff9e9"), Color.parseColor("#fff4de"), Color.parseColor("#fff0d3"));

        Path shellPath = new Path();
        shellPath.moveTo(55f, 4f);
        shellPath.cubicTo(28f, 4f, 8f, 23f, 8f, 52f);
        shellPath.lineTo(8f, 518f);
        shellPath.cubicTo(8f, 545f, 26f, 561f, 53f, 561f);
        shellPath.lineTo(347f, 561f);
        shellPath.cubicTo(374f, 561f, 392f, 545f, 392f, 518f);
        shellPath.lineTo(392f, 52f);
        shellPath.cubicTo(392f, 23f, 372f, 4f, 345f, 4f);
        shellPath.close();
        canvas.drawPath(shellPath, shell);
        canvas.drawPath(shellPath, strokePaint(palette.shellEnd, 3f));

        Path insetPath = new Path();
        insetPath.moveTo(56f, 11f);
        insetPath.cubicTo(32f, 11f, 15f, 28f, 15f, 53f);
        insetPath.lineTo(15f, 517f);
        insetPath.cubicTo(15f, 539f, 30f, 553f, 54f, 553f);
        insetPath.lineTo(346f, 553f);
        insetPath.cubicTo(370f, 553f, 385f, 539f, 385f, 517f);
        insetPath.lineTo(385f, 53f);
        insetPath.cubicTo(385f, 28f, 368f, 11f, 344f, 11f);
        insetPath.close();
        canvas.drawPath(insetPath, inset);
        canvas.drawPath(insetPath, strokePaint(Color.parseColor("#f7ffff"), 4f));

        Path paperPath = new Path();
        paperPath.moveTo(39f, 55f);
        paperPath.cubicTo(82f, 43f, 124f, 49f, 164f, 50f);
        paperPath.cubicTo(222f, 52f, 276f, 40f, 326f, 45f);
        paperPath.cubicTo(344f, 47f, 357f, 51f, 365f, 57f);
        paperPath.lineTo(364f, 462f);
        paperPath.cubicTo(364f, 479f, 352f, 487f, 335f, 487f);
        paperPath.cubicTo(290f, 498f, 245f, 507f, 200f, 507f);
        paperPath.cubicTo(144f, 507f, 99f, 497f, 53f, 485f);
        paperPath.cubicTo(37f, 481f, 29f, 473f, 29f, 457f);
        paperPath.lineTo(28f, 75f);
        paperPath.cubicTo(28f, 66f, 31f, 59f, 39f, 55f);
        paperPath.close();
        canvas.drawPath(paperPath, paper);
        canvas.drawPath(topPaperHighlight(), strokePaint(Color.parseColor("#fffdf2"), 3f));
        canvas.drawPath(glassShine(), strokePaint(Color.WHITE, 3f));
        canvas.drawPath(bottomPaperCurve(), strokePaint(Color.parseColor("#e9ffff"), 2f));

        Paint badge = fillPaint(palette.badge);
        canvas.drawCircle(66.5f, 65.5f, 42.5f, badge);
        canvas.drawCircle(66.5f, 65.5f, 42.5f, strokePaint(Color.parseColor("#e7ffff"), 3.75f));
        Paint tierPaint = textPaint(Color.WHITE, superWaterTypeface, 35f);
        tierPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(tier, 66.5f, 77.5f, tierPaint);

        Paint termPaint = textPaint(Color.parseColor("#102d49"), Typeface.create("sans-serif", Typeface.BOLD), 50f);
        Paint translationPaint = textPaint(Color.parseColor("#173653"), Typeface.create("sans-serif", Typeface.BOLD), 31f);
        termPaint.setTextAlign(Paint.Align.CENTER);
        translationPaint.setTextAlign(Paint.Align.CENTER);
        drawFittedText(canvas, term, 200f, 151f, termPaint, 272f);
        drawFittedText(canvas, translation, 200f, 220f, translationPaint, 272f);

        Paint pronunciationPaint = textPaint(Color.WHITE, Typeface.create("sans-serif", Typeface.BOLD), 21f);
        pronunciationPaint.setTextAlign(Paint.Align.CENTER);
        float pronunciationWidth = Math.min(272f, Math.max(118f, pronunciationPaint.measureText(pronunciation) + 77f));
        canvas.drawRoundRect(new RectF(200f - pronunciationWidth / 2f, 279f, 200f + pronunciationWidth / 2f, 322f), 22f, 22f, fillPaint(palette.label));
        drawSpeakerIcon(canvas, 200f - pronunciationWidth / 2f + 26f, 300.5f, 22f);
        drawFittedText(canvas, pronunciation, 200f + 14f, 307f, pronunciationPaint, pronunciationWidth - 58f);

        canvas.drawLine(64f, 342f, 336f, 342f, strokePaint(Color.parseColor("#b6a984"), 1.25f));
        Paint examplePaint = textPaint(Color.parseColor("#173653"), Typeface.create("sans-serif", Typeface.BOLD), 24f);
        examplePaint.setTextAlign(Paint.Align.CENTER);
        int visibleLines = drawExampleText(canvas, example, 200f, 367f, examplePaint, 272f);
        if (visibleLines < 3) drawCardFoxMark(canvas);
        canvas.restore();
    }

    private int drawExampleText(Canvas canvas, String example, float centerX, float top, Paint paint, float maxWidth) {
        if (example == null || example.trim().isEmpty()) return 0;
        List<String> lines = new ArrayList<>();
        for (String paragraph : example.trim().split("\\r?\\n")) {
            String remaining = paragraph.trim();
            while (!remaining.isEmpty()) {
                int count = paint.breakText(remaining, true, maxWidth, null);
                if (count <= 0) break;
                int end = count;
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
            while (last.length() > 1 && paint.measureText(last + "…") > maxWidth) last = last.substring(0, last.length() - 1).trim();
            lines.set(2, last + "…");
        }
        float baseline = top - paint.ascent();
        float lineHeight = paint.getTextSize() * 1.35f;
        for (String line : lines) {
            canvas.drawText(line, centerX, baseline, paint);
            baseline += lineHeight;
        }
        return lines.size();
    }

    private void drawSpeakerIcon(Canvas canvas, float centerX, float centerY, float size) {
        Path speaker = new Path();
        float left = centerX - size / 2f;
        float top = centerY - size / 2f;
        speaker.moveTo(left + size * .10f, top + size * .38f);
        speaker.lineTo(left + size * .34f, top + size * .38f);
        speaker.lineTo(left + size * .62f, top + size * .15f);
        speaker.lineTo(left + size * .62f, top + size * .85f);
        speaker.lineTo(left + size * .34f, top + size * .62f);
        speaker.lineTo(left + size * .10f, top + size * .62f);
        speaker.close();
        Paint icon = fillPaint(Color.WHITE);
        canvas.drawPath(speaker, icon);
        Paint waves = strokePaint(Color.WHITE, 2f);
        waves.setStyle(Paint.Style.STROKE);
        waves.setStrokeCap(Paint.Cap.ROUND);
        RectF wave = new RectF(left + size * .48f, top + size * .20f, left + size * 1.02f, top + size * .80f);
        canvas.drawArc(wave, -52f, 104f, false, waves);
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
        face.moveTo(27f, 34f); face.lineTo(27.1f, 34f);
        face.moveTo(49f, 34f); face.lineTo(49.1f, 34f);
        face.moveTo(35f, 40f); face.cubicTo(38f, 43f, 40f, 43f, 43f, 40f);
        canvas.save();
        canvas.translate(160f, 445f);
        canvas.scale(80f / 76f, 62f / 58f);
        Paint shadow = strokePaint(Color.parseColor("#b29a70"), 4f);
        shadow.setStrokeCap(Paint.Cap.ROUND); shadow.setStrokeJoin(Paint.Join.ROUND);
        canvas.translate(0f, -1f); canvas.drawPath(outline, shadow); canvas.translate(0f, 2f);
        Paint highlight = strokePaint(Color.parseColor("#fff7e4"), 2.4f);
        highlight.setStrokeCap(Paint.Cap.ROUND); highlight.setStrokeJoin(Paint.Join.ROUND);
        canvas.drawPath(outline, highlight); canvas.translate(0f, -1.8f);
        Paint faceShadow = strokePaint(Color.parseColor("#a88f65"), 2.7f);
        faceShadow.setStrokeCap(Paint.Cap.ROUND); canvas.drawPath(face, faceShadow); canvas.translate(0f, 1.6f);
        Paint faceHighlight = strokePaint(Color.parseColor("#fff8e9"), 1.3f);
        faceHighlight.setStrokeCap(Paint.Cap.ROUND); canvas.drawPath(face, faceHighlight);
        canvas.restore();
    }

    private static Path topPaperHighlight() { Path p = new Path(); p.moveTo(39f, 55f); p.cubicTo(82f, 43f, 124f, 49f, 164f, 50f); p.cubicTo(222f, 52f, 276f, 40f, 326f, 45f); p.cubicTo(344f, 47f, 357f, 51f, 365f, 57f); return p; }
    private static Path glassShine() { Path p = new Path(); p.moveTo(43f, 67f); p.cubicTo(40f, 112f, 41f, 184f, 41f, 252f); p.cubicTo(41f, 335f, 42f, 409f, 45f, 459f); p.moveTo(357f, 67f); p.cubicTo(360f, 121f, 359f, 186f, 359f, 251f); p.cubicTo(359f, 336f, 358f, 405f, 355f, 458f); return p; }
    private static Path bottomPaperCurve() { Path p = new Path(); p.moveTo(43f, 488f); p.cubicTo(96f, 503f, 146f, 512f, 200f, 512f); p.cubicTo(256f, 512f, 306f, 503f, 358f, 489f); return p; }

    private static void drawFittedText(Canvas canvas, String text, float centerX, float baseline, Paint paint, float maxWidth) {
        if (text == null || text.isEmpty()) return;
        float width = paint.measureText(text);
        if (width <= maxWidth) { canvas.drawText(text, centerX, baseline, paint); return; }
        canvas.save();
        canvas.translate(centerX, baseline);
        canvas.scale(maxWidth / width * .96f, 1f);
        canvas.drawText(text, 0f, 0f, paint);
        canvas.restore();
    }

    private static Paint fillPaint(int color) { Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG); paint.setColor(color); return paint; }
    private static Paint textPaint(int color, Typeface typeface, float size) { Paint paint = fillPaint(color); paint.setTypeface(typeface); paint.setTextSize(size); return paint; }
    private static Paint strokePaint(int color, float width) { Paint paint = fillPaint(color); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(width); return paint; }
    private static Paint gradientPaint(int start, int middle, int end) { Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG); paint.setShader(new LinearGradient(0f, 0f, 400f, 570f, new int[]{start, middle, end}, null, Shader.TileMode.CLAMP)); return paint; }

    private static int tierColor(String tier) {
        if ("A2".equals(tier)) return Color.parseColor("#36b9ca");
        if ("B1".equals(tier)) return Color.parseColor("#b163ff");
        if ("B2".equals(tier)) return Color.parseColor("#ffae00");
        if ("C1".equals(tier)) return Color.parseColor("#fa5252");
        return Color.parseColor("#52bf70");
    }

    private static Palette palette(int tierColor, String tier) {
        if ("A1".equals(tier)) return new Palette("#6bd38a", "#a9e6a7", "#55c875", "#78d78d", "#49bd6b", "#9ce1a0", "#52bf70", "#61c97b");
        if ("A2".equals(tier)) return new Palette("#72dce5", "#b9f5ee", "#55c9d5", "#75e2e7", "#53c5d2", "#82e5df", "#36b9ca", "#43b9ca");
        if ("B1".equals(tier)) return new Palette("#b568ff", "#c994ff", "#b163ff", "#b96cff", "#9b58df", "#ca92ff", "#b163ff", "#9b58df");
        if ("B2".equals(tier)) return new Palette("#f6b018", "#f9c875", "#ffae00", "#f7b62c", "#df9700", "#f9c15c", "#ffae00", "#df9700");
        return new Palette("#fa6262", "#fb8b8b", "#fa5252", "#fa6b6b", "#dc4848", "#fb8585", "#fa5252", "#dc4848");
    }

    private static String safeText(String value) { return safeText(value, ""); }
    private static String safeText(String value, String fallback) { return value == null || value.trim().isEmpty() ? fallback : value; }
    private static String safeTier(String value) { return "A2".equals(value) || "B1".equals(value) || "B2".equals(value) || "C1".equals(value) ? value : "A1"; }
    private static Typeface loadSuperWaterTypeface(Context context) { try { return Typeface.createFromAsset(context.getAssets(), "foxiesdeck-offline/super-water.ttf"); } catch (RuntimeException ignored) { return Typeface.create("sans-serif-rounded", Typeface.BOLD); } }

    private static final class Palette {
        final int shellPrimary, shellHighlight, shellEnd, insetPrimary, insetMiddle, insetEnd, badge, label;
        Palette(String shellPrimary, String shellHighlight, String shellEnd, String insetPrimary, String insetMiddle, String insetEnd, String badge, String label) {
            this.shellPrimary = Color.parseColor(shellPrimary); this.shellHighlight = Color.parseColor(shellHighlight); this.shellEnd = Color.parseColor(shellEnd);
            this.insetPrimary = Color.parseColor(insetPrimary); this.insetMiddle = Color.parseColor(insetMiddle); this.insetEnd = Color.parseColor(insetEnd);
            this.badge = Color.parseColor(badge); this.label = Color.parseColor(label);
        }
    }
}
