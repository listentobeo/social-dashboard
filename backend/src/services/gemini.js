const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI;
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI;
}

async function analyzePerformance(accountData, posts, competitors = []) {
  const model = getClient().getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const topPosts = [...posts]
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
    .slice(0, 10);

  const bottomPosts = [...posts]
    .sort((a, b) => (a.engagement_rate || 0) - (b.engagement_rate || 0))
    .slice(0, 5);

  const avgEngagement = posts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / (posts.length || 1);

  const contentTypeBreakdown = posts.reduce((acc, p) => {
    acc[p.content_type] = (acc[p.content_type] || 0) + 1;
    return acc;
  }, {});

  const competitorSummary = competitors.map(c => ({
    handle: c.handle,
    platform: c.platform,
    followers: c.followers_count,
    avg_engagement: c.avg_engagement_rate,
  }));

  const prompt = `You are a social media growth strategist analyzing data for ${accountData.handle} on ${accountData.platform}.

## Account Overview
- Followers: ${accountData.followers_count}
- Total posts analyzed: ${posts.length}
- Average engagement rate: ${avgEngagement.toFixed(2)}%
- Content type breakdown: ${JSON.stringify(contentTypeBreakdown)}

## Top Performing Posts (sample captions and metrics)
${topPosts.slice(0, 5).map(p => `- "${(p.caption || '').slice(0, 80)}..." | Likes: ${p.likes_count} | Comments: ${p.comments_count} | Views: ${p.views_count} | Engagement: ${p.engagement_rate}%`).join('\n')}

## Underperforming Posts
${bottomPosts.slice(0, 3).map(p => `- "${(p.caption || '').slice(0, 80)}..." | Likes: ${p.likes_count} | Comments: ${p.comments_count} | Engagement: ${p.engagement_rate}%`).join('\n')}

${competitors.length > 0 ? `## Competitor Benchmarks\n${competitorSummary.map(c => `- @${c.handle}: ${c.followers} followers, ${c.avg_engagement}% avg engagement`).join('\n')}` : ''}

Provide a direct, actionable analysis in this exact format:

**WHY YOUR CONTENT ISN'T PERFORMING**
(2-3 specific reasons based on the data patterns above)

**WHAT YOUR AUDIENCE WANTS**
(3-4 content formats or topics that are clearly resonating based on your top posts)

**IMMEDIATE ACTIONS**
(3 specific things to do in the next 7 days — be very specific, not generic)

**CONTENT FORMULA THAT WORKS FOR YOU**
(Based on your top posts, what's the repeatable pattern?)

${competitors.length > 0 ? '**COMPETITOR EDGE**\n(What are competitors doing that you should steal or avoid?)' : ''}

Be brutally honest and specific. No generic advice.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function analyzeCompetitor(competitorData, competitorPosts, myPosts = []) {
  const model = getClient().getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

  const theirTop = [...competitorPosts]
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
    .slice(0, 5);

  const myTop = [...myPosts]
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0))
    .slice(0, 5);

  const prompt = `You are a competitor intelligence analyst.

## Competitor: @${competitorData.handle} on ${competitorData.platform}
- Followers: ${competitorData.followers_count}
- Posts analyzed: ${competitorPosts.length}
- Avg engagement: ${competitorData.avg_engagement_rate}%

## Their Top Posts
${theirTop.map(p => `- "${(p.caption || '').slice(0, 80)}..." | Engagement: ${p.engagement_rate}% | Likes: ${p.likes_count} | Views: ${p.views_count}`).join('\n')}

${myTop.length > 0 ? `## Your Top Posts (for comparison)\n${myTop.map(p => `- "${(p.caption || '').slice(0, 80)}..." | Engagement: ${p.engagement_rate}%`).join('\n')}` : ''}

Provide intelligence report:

**WHAT'S WORKING FOR THEM**
(Specific patterns in their top content)

**CONTENT GAPS YOU CAN OWN**
(What they're NOT covering that you could dominate)

**STEAL THESE TACTICS**
(3 specific tactics from their strategy you should adopt immediately)

**THEIR WEAKNESS**
(Where their engagement drops and why you can outperform them there)

Be direct. No fluff.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { analyzePerformance, analyzeCompetitor };
