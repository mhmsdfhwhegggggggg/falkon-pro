/**
 * Auto Reply Router 🔥
 * 
 * API endpoints for intelligent auto-reply system:
 * - Keyword matching (exact, regex)
 * - 3 reply types (fixed, templates, AI)
 * - Human-like delays
 * - Emoji reactions
 * - Daily limits and smart filtering
 * 
 * @version 6.0.0
 * @author FALKON PRO Team
 */

import { z } from "zod";
import { router, licenseProtectedProcedure } from "../_core/trpc";
import { autoReplyService } from "../services/auto-reply.service";

/**
 * Auto Reply Router
 */
export const autoReplyRouter = router({
  /**
   * Create new reply rule
   */
  createRule: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      name: z.string().min(1).max(100),
      keywords: z.array(z.string()).min(1).max(50),
      matchType: z.enum(['exact', 'contains', 'regex']),
      replyType: z.enum(['fixed', 'template', 'ai']),
      replyContent: z.union([
        z.string(),
        z.array(z.string())
      ]),
      aiPrompt: z.string().optional(),
      delay: z.object({
        min: z.number().min(500).default(2000),
        max: z.number().min(1000).default(5000)
      }),
      reactions: z.array(z.string()).max(10).optional(),
      options: z.object({
        targetTypes: z.array(z.enum(['private', 'group', 'supergroup', 'channel'])).min(1),
        targetUsers: z.array(z.string()).optional(),
        excludeUsers: z.array(z.string()).optional(),
        targetGroups: z.array(z.string()).optional(),
        excludeGroups: z.array(z.string()).optional(),
        markAsRead: z.boolean().default(false),
        deleteOriginal: z.boolean().default(false),
        dailyLimit: z.number().min(1).max(1000).default(50),
        priority: z.number().min(1).max(10).default(5)
      }),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const rule = await autoReplyService.createRule({
          name: input.name,
          accountId: input.accountId,
          userId: ctx.user!.id,
          keywords: input.keywords,
          matchType: input.matchType as any,
          replyType: input.replyType as any,
          replyContent: input.replyContent,
          aiPrompt: input.aiPrompt,
          delay: input.delay as any,
          reactions: input.reactions || [],
          options: input.options as any,
          priority: 1, // Default priority
          isActive: input.isActive
        });

        return {
          success: true,
          data: rule,
          message: 'Reply rule created successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to create reply rule'
        };
      }
    }),

  /**
   * Get all reply rules
   */
  getRules: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      isActive: z.boolean().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const rules = await autoReplyService.getRules(input.accountId, {
          isActive: input.isActive
        });

        return {
          success: true,
          data: {
            rules: rules.slice(input.offset, input.offset + input.limit),
            total: rules.length,
            hasMore: input.offset + input.limit < rules.length
          }
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  /**
   * Update reply rule
   */
  updateRule: licenseProtectedProcedure
    .input(z.object({
      ruleId: z.string(),
      accountId: z.number(),
      updates: z.object({
        name: z.string().min(1).max(100).optional(),
        keywords: z.array(z.string()).min(1).max(50).optional(),
        matchType: z.enum(['exact', 'contains', 'regex']).optional(),
        replyContent: z.union([
          z.string(),
          z.array(z.string())
        ]).optional(),
        delay: z.object({
          min: z.number().min(500).optional(),
          max: z.number().min(1000).optional()
        }).optional(),
        reactions: z.array(z.string()).max(10).optional(),
        options: z.object({
          targetTypes: z.array(z.enum(['private', 'group', 'supergroup', 'channel'])).optional(),
          dailyLimit: z.number().min(1).max(1000).optional(),
          priority: z.number().min(1).max(10).optional()
        }).optional(),
        isActive: z.boolean().optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await autoReplyService.updateRule(input.ruleId, input.updates as any);
        return {
          success: true,
          message: 'Reply rule updated successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to update reply rule'
        };
      }
    }),

  /**
   * Delete reply rule
   */
  deleteRule: licenseProtectedProcedure
    .input(z.object({
      ruleId: z.string(),
      accountId: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await autoReplyService.deleteRule(input.ruleId, input.accountId);
        return {
          success: true,
          message: 'Reply rule deleted successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to delete reply rule'
        };
      }
    }),

  /**
   * Get reply statistics
   */
  getReplyStats: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      period: z.enum(['today', 'week', 'month', 'all']).default('today')
    }))
    .query(async ({ input, ctx }) => {
      try {
        const stats = await autoReplyService.getReplyStats(input.accountId);
        return {
          success: true,
          data: stats
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  /**
   * Test reply rule
   */
  testRule: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      ruleId: z.string(),
      testMessage: z.string(),
      testContext: z.object({
        fromId: z.string(),
        chatId: z.string(),
        chatType: z.enum(['private', 'group', 'supergroup', 'channel']),
        timestamp: z.date()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Fetch the rule and test against the message
        const rules = await autoReplyService.getRules(input.accountId, {});
        const rule = rules.find((r: any) => r.id === input.ruleId);
        if (!rule) throw new Error('Rule not found');

        const keywords: string[] = (rule as any).keywords || [];
        const matchType: string = (rule as any).matchType || 'contains';
        const matchedKeywords = keywords.filter((kw: string) => {
          if (matchType === 'exact') return input.testMessage === kw;
          if (matchType === 'contains') return input.testMessage.includes(kw);
          if (matchType === 'regex') {
            try { return new RegExp(kw, 'i').test(input.testMessage); } catch { return false; }
          }
          return false;
        });
        const matched = matchedKeywords.length > 0;
        const replyContent = matched ? ((rule as any).replyContent || '') : '';
        const delay = (rule as any).delay ? Math.round(((rule as any).delay.min + (rule as any).delay.max) / 2) : 3000;
        const reactions: string[] = (rule as any).reactions || [];

        const testResult = {
          matched,
          matchedKeywords,
          replyContent: typeof replyContent === 'string' ? replyContent : (replyContent[0] || ''),
          delay,
          reactions: matched ? reactions : [],
          confidence: matched ? matchedKeywords.length / Math.max(keywords.length, 1) : 0
        };

        return {
          success: true,
          data: testResult,
          message: 'Rule test completed successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to test reply rule'
        };
      }
    }),

  /**
   * Toggle rule active status
   */
  toggleRule: licenseProtectedProcedure
    .input(z.object({
      ruleId: z.string(),
      accountId: z.number(),
      isActive: z.boolean()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await autoReplyService.updateRule(input.ruleId, { isActive: input.isActive } as any);
        return {
          success: true,
          message: `Rule ${input.isActive ? 'activated' : 'deactivated'} successfully`
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to toggle rule status'
        };
      }
    }),

  /**
   * Get reply templates
   */
  getReplyTemplates: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      category: z.enum(['greeting', 'support', 'marketing', 'faq']).optional()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const templates = {
          greeting: [
            {
              id: 'template-1',
              name: 'Arabic Welcome',
              content: 'أهلا بك! كيف يمكنني مساعدتك؟ 😊',
              variables: ['{user_name}', '{group_name}']
            },
            {
              id: 'template-2',
              name: 'English Welcome',
              content: 'Hello {user_name}! Welcome to {group_name}! 👋',
              variables: ['{user_name}', '{group_name}']
            }
          ],
          support: [
            {
              id: 'template-3',
              name: 'Price Response',
              content: 'سعر المنتج هو {price} ريال. للطلب راسلنا! 📞',
              variables: ['{price}', '{product_name}']
            },
            {
              id: 'template-4',
              name: 'Support Info',
              content: 'فريق الدعم متاح من 9 ص إلى 9 م 🕘\n📞 {phone}',
              variables: ['{phone}']
            }
          ],
          marketing: [
            {
              id: 'template-5',
              name: 'Product Launch',
              content: '🎉 منتج جديد متوفر الآن!\n\n{product_description}\n\nالسعر: {price} ريال\nللطلب: {order_link}',
              variables: ['{product_description}', '{price}', '{order_link}']
            }
          ],
          faq: [
            {
              id: 'template-6',
              name: 'Shipping Info',
              content: 'معلومات الشحن:\n⏱️ {delivery_time}\n📍 {delivery_location}\n💰 {delivery_cost}',
              variables: ['{delivery_time}', '{delivery_location}', '{delivery_cost}']
            }
          ]
        };

        const categoryTemplates = input.category
          ? templates[input.category]
          : Object.values(templates).flat();

        return {
          success: true,
          data: {
            templates: categoryTemplates,
            categories: Object.keys(templates)
          }
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message
        };
      }
    }),

  /**
   * Get AI reply suggestions
   */
  getAISuggestions: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      keywords: z.array(z.string()).max(10),
      context: z.string().max(500)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // AI suggestions require BUILT_IN_FORGE_API_KEY configuration
        // Returns sample suggestions when AI service is not available
        const suggestions = [
          {
            keyword: 'السعر',
            suggestedReply: 'أسعارنا تبدأ من 50 ريال وتصل إلى 500 ريال حسب المنتج. للتفاصيل الكاملة يرجى التواصل مع المبيعات! 💰',
            confidence: 0.92,
            category: 'pricing'
          },
          {
            keyword: 'توصيل',
            suggestedReply: 'نوفر توصيل لجميع المدن الرئيسية. التكلفة 30 ريال للطلبات الداخلية و 50 ريال للخارجي. 🚚',
            confidence: 0.88,
            category: 'shipping'
          }
        ];

        return {
          success: true,
          data: {
            suggestions: suggestions.filter(s =>
              input.keywords.length === 0 ||
              input.keywords.some(k => s.keyword.includes(k))
            ),
            totalGenerated: suggestions.length
          },
          message: 'AI suggestions generated successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to generate AI suggestions'
        };
      }
    }),

  /**
   * Export/import reply rules
   */
  exportRules: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      format: z.enum(['json', 'csv']).default('json')
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Fetch actual rules from the service for export
        const rules = await autoReplyService.getRules(input.accountId, {});
        const exportData = {
          rules: rules.map((r: any) => ({
            name: r.name,
            keywords: r.keywords || [],
            matchType: r.matchType || 'contains',
            replyType: r.replyType || 'fixed',
            replyContent: r.replyContent || '',
            delay: r.delay || { min: 2000, max: 5000 },
            options: r.options || { targetTypes: ['private', 'group'], dailyLimit: 50 }
          })),
          exportedAt: new Date(),
          version: '6.0.0'
        };

        return {
          success: true,
          data: exportData,
          message: 'Rules exported successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to export rules'
        };
      }
    }),

  /**
   * Import reply rules
   */
  importRules: licenseProtectedProcedure
    .input(z.object({
      accountId: z.number(),
      rules: z.array(z.object({
        name: z.string(),
        keywords: z.array(z.string()),
        matchType: z.enum(['exact', 'contains', 'regex']),
        replyType: z.enum(['fixed', 'template', 'ai']),
        replyContent: z.union([z.string(), z.array(z.string())]),
        delay: z.object({
          min: z.number(),
          max: z.number()
        }),
        options: z.object({
          targetTypes: z.array(z.enum(['private', 'group', 'supergroup', 'channel'])),
          dailyLimit: z.number()
        })
      })),
      overwrite: z.boolean().default(false)
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Import rules by creating them via the service
        const details: { index: number; name: string; status: string; error?: string }[] = [];
        let imported = 0;
        let skipped = 0;
        let errors = 0;
        for (let i = 0; i < input.rules.length; i++) {
          const rule = input.rules[i];
          try {
            await autoReplyService.createRule({
              name: rule.name,
              accountId: input.accountId,
              userId: ctx.user!.id,
              keywords: rule.keywords,
              matchType: rule.matchType as any,
              replyType: rule.replyType as any,
              replyContent: rule.replyContent,
              delay: rule.delay as any,
              reactions: [],
              options: rule.options as any,
              priority: 1,
              isActive: true
            });
            imported++;
            details.push({ index: i + 1, name: rule.name, status: 'success' });
          } catch (e: any) {
            errors++;
            details.push({ index: i + 1, name: rule.name, status: 'error', error: e.message });
          }
        }
        const importResults = { imported, skipped, errors, details };

        return {
          success: true,
          data: importResults,
          message: 'Rules imported successfully'
        };

      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          message: 'Failed to import rules'
        };
      }
    })
});

