import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../db/index';
import { settings } from '../../db/schema';
import { eq } from 'drizzle-orm';

interface UpdateSettingRequest {
  Body: {
    value: string;
  };
  Params: {
    key: string;
  };
}

const settingsModule: FastifyPluginAsync = async (fastify) => {
  // Get a setting by key (public endpoint)
  fastify.get<{ Params: { key: string } }>(
    '/settings/:key',
    async (request, reply) => {
      const { key } = request.params;

      const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (!setting) {
        return reply.code(404).send({
          error: 'Setting not found',
        });
      }

      return reply.send({
        key: setting.key,
        value: setting.value,
      });
    }
  );

  // Get all settings (public endpoint)
  fastify.get('/settings', async (request, reply) => {
    const allSettings = await db.select().from(settings);

    // Convert to key-value object
    const settingsObject = allSettings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string>
    );

    return reply.send(settingsObject);
  });

  // Update a setting (TODO: add auth protection with Better Auth)
  fastify.put<UpdateSettingRequest>(
    '/settings/:key',
    {
      schema: {
        body: {
          type: 'object',
          required: ['value'],
          properties: {
            value: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { key } = request.params;
      const { value } = request.body;
      const userId = 'system'; // TODO: get from Better Auth session

      // Check if setting exists
      const [existingSetting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (existingSetting) {
        // Update existing setting
        const [updated] = await db
          .update(settings)
          .set({
            value,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(settings.key, key))
          .returning();

        return reply.send({
          key: updated.key,
          value: updated.value,
        });
      } else {
        // Create new setting
        const [created] = await db
          .insert(settings)
          .values({
            key,
            value,
            updatedBy: userId,
          })
          .returning();

        return reply.send({
          key: created.key,
          value: created.value,
        });
      }
    }
  );

  // Delete a setting (TODO: add auth protection with Better Auth)
  fastify.delete<{ Params: { key: string } }>(
    '/settings/:key',
    async (request, reply) => {
      const { key } = request.params;

      const [deleted] = await db
        .delete(settings)
        .where(eq(settings.key, key))
        .returning();

      if (!deleted) {
        return reply.code(404).send({
          error: 'Setting not found',
        });
      }

      return reply.send({
        message: 'Setting deleted successfully',
        key: deleted.key,
      });
    }
  );
};

export default fp(settingsModule, {
  name: 'settings',
});
